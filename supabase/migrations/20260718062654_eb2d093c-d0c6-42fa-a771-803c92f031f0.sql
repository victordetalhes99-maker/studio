
-- =============================================================================
-- Módulo Clientes de Risco — persistência da revisão administrativa
-- =============================================================================
-- Os alertas são DERIVADOS da tabela `clientes` (anamnese/sessões) por
-- funções TypeScript. Aqui persistimos apenas a REVISÃO humana e o histórico
-- imutável de eventos por alert_id estável.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.risk_reviews (
  alert_id            text PRIMARY KEY,
  cpf                 text NOT NULL,
  form_id             text NOT NULL,
  form_version        integer NOT NULL DEFAULT 1,
  level               text NOT NULL CHECK (level IN ('attention','high')),
  status              text NOT NULL DEFAULT 'pending_review'
                       CHECK (status IN ('pending_review','under_review','reviewed','requires_attention','released','archived')),
  decision            text,
  observacao          text,
  previous_decision   text,
  previous_observacao text,
  reviewed_by         uuid,
  reviewed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.risk_reviews TO authenticated;
GRANT ALL ON public.risk_reviews TO service_role;

ALTER TABLE public.risk_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read risk_reviews" ON public.risk_reviews
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admins upsert risk_reviews" ON public.risk_reviews
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admins update risk_reviews" ON public.risk_reviews
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.tg_risk_reviews_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TRIGGER trg_risk_reviews_touch
BEFORE UPDATE ON public.risk_reviews
FOR EACH ROW EXECUTE FUNCTION public.tg_risk_reviews_touch();

-- ---------------------------------------------------------------------------
-- Histórico imutável
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.risk_review_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id    text NOT NULL,
  kind        text NOT NULL CHECK (kind IN (
                'created','review_started','decision_recorded','decision_changed',
                'note_added','archived','reopened','new_version'
              )),
  from_status text,
  to_status   text,
  from_decision text,
  to_decision   text,
  actor_id    uuid,
  motivo      text,
  detalhes    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.risk_review_events TO authenticated;
GRANT ALL ON public.risk_review_events TO service_role;

ALTER TABLE public.risk_review_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read risk_events" ON public.risk_review_events
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admins insert risk_events" ON public.risk_review_events
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_risk_review_events_alert ON public.risk_review_events(alert_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_reviews_status ON public.risk_reviews(status);
CREATE INDEX IF NOT EXISTS idx_risk_reviews_cpf ON public.risk_reviews(cpf);

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Registra decisão preservando anterior + evento
CREATE OR REPLACE FUNCTION public.risk_review_set(
  _alert_id     text,
  _cpf          text,
  _form_id      text,
  _form_version integer,
  _level        text,
  _new_status   text,
  _decision     text,
  _observacao   text,
  _motivo_alt   text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d_cpf text := regexp_replace(coalesce(_cpf,''),'\D','','g');
  existing public.risk_reviews%ROWTYPE;
  is_change boolean := false;
  from_status text;
  from_decision text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  IF _alert_id IS NULL OR length(_alert_id)=0 THEN RAISE EXCEPTION 'alert_id obrigatório'; END IF;
  IF d_cpf !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'CPF inválido'; END IF;
  IF _level NOT IN ('attention','high') THEN RAISE EXCEPTION 'Nível inválido'; END IF;
  IF _new_status NOT IN ('pending_review','under_review','reviewed','requires_attention','released','archived') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  SELECT * INTO existing FROM public.risk_reviews WHERE alert_id = _alert_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.risk_reviews(
      alert_id, cpf, form_id, form_version, level, status,
      decision, observacao, reviewed_by, reviewed_at
    ) VALUES (
      _alert_id, d_cpf, _form_id, coalesce(_form_version,1), _level, _new_status,
      NULLIF(btrim(coalesce(_decision,'')),''),
      NULLIF(btrim(coalesce(_observacao,'')),''),
      CASE WHEN _new_status IN ('pending_review') THEN NULL ELSE auth.uid() END,
      CASE WHEN _new_status IN ('pending_review') THEN NULL ELSE now() END
    );
    INSERT INTO public.risk_review_events(alert_id, kind, to_status, to_decision, actor_id)
      VALUES (_alert_id, 'created', _new_status, NULLIF(btrim(coalesce(_decision,'')),''), auth.uid());
    RETURN;
  END IF;

  from_status := existing.status;
  from_decision := existing.decision;
  is_change := (existing.decision IS DISTINCT FROM NULLIF(btrim(coalesce(_decision,'')),''))
            OR (existing.status IS DISTINCT FROM _new_status);

  -- Se está alterando uma decisão registrada anteriormente, exigir motivo.
  IF existing.decision IS NOT NULL AND is_change
     AND NULLIF(btrim(coalesce(_decision,'')),'') IS DISTINCT FROM existing.decision THEN
    IF _motivo_alt IS NULL OR length(btrim(_motivo_alt)) < 3 THEN
      RAISE EXCEPTION 'Motivo obrigatório para alterar decisão registrada';
    END IF;
  END IF;

  UPDATE public.risk_reviews SET
    level               = _level,
    status              = _new_status,
    previous_decision   = CASE WHEN is_change THEN existing.decision ELSE existing.previous_decision END,
    previous_observacao = CASE WHEN is_change THEN existing.observacao ELSE existing.previous_observacao END,
    decision            = NULLIF(btrim(coalesce(_decision,'')),''),
    observacao          = NULLIF(btrim(coalesce(_observacao,'')),''),
    reviewed_by         = CASE WHEN _new_status='pending_review' THEN existing.reviewed_by ELSE auth.uid() END,
    reviewed_at         = CASE WHEN _new_status='pending_review' THEN existing.reviewed_at ELSE now() END,
    form_version        = coalesce(_form_version, existing.form_version)
  WHERE alert_id = _alert_id;

  IF is_change THEN
    INSERT INTO public.risk_review_events(
      alert_id, kind, from_status, to_status, from_decision, to_decision, actor_id, motivo
    ) VALUES (
      _alert_id,
      CASE WHEN existing.decision IS NULL THEN 'decision_recorded' ELSE 'decision_changed' END,
      from_status, _new_status, from_decision,
      NULLIF(btrim(coalesce(_decision,'')),''),
      auth.uid(),
      NULLIF(btrim(coalesce(_motivo_alt,'')),'')
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.risk_review_add_note(_alert_id text, _texto text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  IF _texto IS NULL OR length(btrim(_texto)) = 0 THEN RAISE EXCEPTION 'Texto obrigatório'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.risk_reviews WHERE alert_id=_alert_id) THEN
    RAISE EXCEPTION 'Alerta não encontrado';
  END IF;
  INSERT INTO public.risk_review_events(alert_id, kind, actor_id, motivo)
  VALUES (_alert_id, 'note_added', auth.uid(), btrim(_texto));
END $$;

CREATE OR REPLACE FUNCTION public.risk_review_archive(_alert_id text, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  IF _motivo IS NULL OR length(btrim(_motivo)) < 3 THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;
  UPDATE public.risk_reviews SET status='archived', reviewed_by=auth.uid(), reviewed_at=now()
   WHERE alert_id=_alert_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alerta não encontrado'; END IF;
  INSERT INTO public.risk_review_events(alert_id, kind, to_status, actor_id, motivo)
  VALUES (_alert_id, 'archived', 'archived', auth.uid(), btrim(_motivo));
END $$;
