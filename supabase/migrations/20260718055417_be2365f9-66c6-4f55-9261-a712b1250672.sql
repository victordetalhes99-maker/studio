
-- ============================================================================
-- Enums
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.check_in_status AS ENUM
    ('waiting','called','in_service','completed','cancelled','no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.check_in_event_kind AS ENUM
    ('created','called','started','completed','cancelled','no_show',
     'reordered','note_added','reopened');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- check_ins
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.check_ins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf           text NOT NULL,
  cliente_nome  text NOT NULL,
  tatuador      text,
  status        public.check_in_status NOT NULL DEFAULT 'waiting',
  arrival_at    timestamptz NOT NULL DEFAULT now(),
  called_at     timestamptz,
  started_at    timestamptz,
  completed_at  timestamptz,
  cancelled_at  timestamptz,
  cancel_reason text,
  no_show_at    timestamptz,
  queue_day     date NOT NULL DEFAULT (now() at time zone 'America/Fortaleza')::date,
  queue_position integer NOT NULL DEFAULT 0,
  risk_flag     boolean NOT NULL DEFAULT false,
  risk_reasons  text[] NOT NULL DEFAULT '{}',
  has_ficha     boolean NOT NULL DEFAULT false,
  has_assinatura boolean NOT NULL DEFAULT false,
  observacoes   text,
  session_index integer, -- índice em clientes.sessoes quando concluído
  created_by    uuid,
  updated_by    uuid,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_ins_cpf_fmt CHECK (cpf ~ '^[0-9]{11}$'),
  CONSTRAINT check_ins_cancel_reason_len CHECK (cancel_reason IS NULL OR length(cancel_reason) BETWEEN 3 AND 500),
  CONSTRAINT check_ins_obs_len CHECK (observacoes IS NULL OR length(observacoes) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_check_ins_day_status ON public.check_ins(queue_day, status);
CREATE INDEX IF NOT EXISTS idx_check_ins_cpf ON public.check_ins(cpf);
CREATE INDEX IF NOT EXISTS idx_check_ins_tatuador ON public.check_ins(tatuador);
CREATE INDEX IF NOT EXISTS idx_check_ins_arrival ON public.check_ins(arrival_at DESC);
-- Impede que o mesmo CPF tenha 2 check-ins abertos no mesmo dia
CREATE UNIQUE INDEX IF NOT EXISTS uq_check_ins_open_per_cpf_day
  ON public.check_ins(cpf, queue_day)
  WHERE status IN ('waiting','called','in_service');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.check_ins TO authenticated;
GRANT ALL ON public.check_ins TO service_role;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read check_ins"   ON public.check_ins FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admins insert check_ins" ON public.check_ins FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admins update check_ins" ON public.check_ins FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admins delete check_ins" ON public.check_ins FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER tg_check_ins_updated
BEFORE UPDATE ON public.check_ins
FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

-- ============================================================================
-- check_in_events (histórico imutável)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.check_in_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_id  uuid NOT NULL REFERENCES public.check_ins(id) ON DELETE CASCADE,
  kind         public.check_in_event_kind NOT NULL,
  from_status  public.check_in_status,
  to_status    public.check_in_status,
  actor_id     uuid,
  motivo       text,
  detalhes     jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_check_in_events_check_in ON public.check_in_events(check_in_id, criado_em);

GRANT SELECT, INSERT ON public.check_in_events TO authenticated;
GRANT ALL ON public.check_in_events TO service_role;
ALTER TABLE public.check_in_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read check_in_events"   ON public.check_in_events FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admins insert check_in_events" ON public.check_in_events FOR INSERT TO authenticated WITH CHECK (public.is_admin());
-- sem UPDATE nem DELETE: histórico é imutável

-- ============================================================================
-- Trigger: registra evento a cada mudança de status
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_check_ins_log_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k public.check_in_event_kind;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.check_in_events(check_in_id, kind, to_status, actor_id)
    VALUES (NEW.id, 'created', NEW.status, NEW.created_by);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    k := CASE NEW.status
      WHEN 'called'     THEN 'called'
      WHEN 'in_service' THEN 'started'
      WHEN 'completed'  THEN 'completed'
      WHEN 'cancelled'  THEN 'cancelled'
      WHEN 'no_show'    THEN 'no_show'
      WHEN 'waiting'    THEN 'reopened'
      ELSE 'note_added'
    END;
    INSERT INTO public.check_in_events(check_in_id, kind, from_status, to_status, actor_id, motivo)
    VALUES (NEW.id, k, OLD.status, NEW.status, NEW.updated_by,
            CASE WHEN NEW.status='cancelled' THEN NEW.cancel_reason ELSE NULL END);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_check_ins_log_event
AFTER INSERT OR UPDATE ON public.check_ins
FOR EACH ROW EXECUTE FUNCTION public.tg_check_ins_log_event();

-- ============================================================================
-- Trigger: valida transições de status
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_check_ins_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.cpf := regexp_replace(coalesce(NEW.cpf,''),'\D','','g');
  IF NEW.cpf !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'CPF inválido'; END IF;
  NEW.cliente_nome := btrim(coalesce(NEW.cliente_nome,''));
  IF length(NEW.cliente_nome) < 2 THEN RAISE EXCEPTION 'Nome do cliente inválido'; END IF;
  IF NEW.tatuador IS NOT NULL AND length(NEW.tatuador) > 120 THEN RAISE EXCEPTION 'Tatuador inválido'; END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = NEW.status THEN RETURN NEW; END IF;
    IF NOT (
      (OLD.status='waiting'    AND NEW.status IN ('called','cancelled','no_show','in_service')) OR
      (OLD.status='called'     AND NEW.status IN ('in_service','waiting','cancelled','no_show')) OR
      (OLD.status='in_service' AND NEW.status IN ('completed','cancelled')) OR
      (OLD.status='no_show'    AND NEW.status IN ('waiting')) OR
      (OLD.status='cancelled'  AND NEW.status IN ('waiting'))
    ) THEN
      RAISE EXCEPTION 'Transição de status inválida: % → %', OLD.status, NEW.status;
    END IF;

    IF NEW.status='cancelled' AND (NEW.cancel_reason IS NULL OR length(btrim(NEW.cancel_reason)) < 3) THEN
      RAISE EXCEPTION 'Motivo do cancelamento é obrigatório';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_check_ins_validate
BEFORE INSERT OR UPDATE ON public.check_ins
FOR EACH ROW EXECUTE FUNCTION public.tg_check_ins_validate();

-- ============================================================================
-- RPCs de operação
-- ============================================================================
CREATE OR REPLACE FUNCTION public.checkin_create(
  _cpf text, _cliente_nome text, _tatuador text,
  _risk_flag boolean DEFAULT false, _risk_reasons text[] DEFAULT '{}',
  _has_ficha boolean DEFAULT false, _has_assinatura boolean DEFAULT false,
  _observacoes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  d text := regexp_replace(coalesce(_cpf,''),'\D','','g');
  new_id uuid;
  next_pos int;
  today date := (now() at time zone 'America/Fortaleza')::date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  IF d !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'CPF inválido'; END IF;

  -- Duplicidade: já existe check-in aberto hoje?
  IF EXISTS (
    SELECT 1 FROM public.check_ins
    WHERE cpf = d AND queue_day = today AND status IN ('waiting','called','in_service')
  ) THEN
    RAISE EXCEPTION 'Cliente já possui check-in aberto hoje' USING ERRCODE = '23505';
  END IF;

  SELECT COALESCE(MAX(queue_position),0)+1 INTO next_pos
  FROM public.check_ins WHERE queue_day = today;

  INSERT INTO public.check_ins(
    cpf, cliente_nome, tatuador, status, arrival_at, queue_day, queue_position,
    risk_flag, risk_reasons, has_ficha, has_assinatura, observacoes, created_by, updated_by
  ) VALUES (
    d, btrim(_cliente_nome), NULLIF(btrim(coalesce(_tatuador,'')),''),
    'waiting', now(), today, next_pos,
    coalesce(_risk_flag,false), coalesce(_risk_reasons,'{}'),
    coalesce(_has_ficha,false), coalesce(_has_assinatura,false),
    NULLIF(btrim(coalesce(_observacoes,'')),''),
    auth.uid(), auth.uid()
  ) RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.checkin_call(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  UPDATE public.check_ins
     SET status='called', called_at=now(), updated_by=auth.uid()
   WHERE id=_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check-in não encontrado'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.checkin_start(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  UPDATE public.check_ins
     SET status='in_service', started_at=now(),
         called_at = COALESCE(called_at, now()),
         updated_by=auth.uid()
   WHERE id=_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check-in não encontrado'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.checkin_complete(_id uuid, _observacao text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  UPDATE public.check_ins
     SET status='completed', completed_at=now(), updated_by=auth.uid(),
         observacoes = COALESCE(NULLIF(btrim(coalesce(_observacao,'')),''), observacoes)
   WHERE id=_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check-in não encontrado'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.checkin_cancel(_id uuid, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  IF _motivo IS NULL OR length(btrim(_motivo)) < 3 THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;
  UPDATE public.check_ins
     SET status='cancelled', cancelled_at=now(), cancel_reason=btrim(_motivo), updated_by=auth.uid()
   WHERE id=_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check-in não encontrado'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.checkin_no_show(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  UPDATE public.check_ins
     SET status='no_show', no_show_at=now(), updated_by=auth.uid()
   WHERE id=_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check-in não encontrado'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.checkin_add_note(_id uuid, _texto text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  IF _texto IS NULL OR length(btrim(_texto)) = 0 THEN RAISE EXCEPTION 'Texto obrigatório'; END IF;
  UPDATE public.check_ins SET observacoes = btrim(_texto), updated_by=auth.uid() WHERE id=_id;
  INSERT INTO public.check_in_events(check_in_id, kind, actor_id, motivo)
  VALUES (_id, 'note_added', auth.uid(), btrim(_texto));
END $$;

CREATE OR REPLACE FUNCTION public.checkin_reorder(_id uuid, _new_position integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d date; old_pos int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  IF _new_position < 1 THEN RAISE EXCEPTION 'Posição inválida'; END IF;
  SELECT queue_day, queue_position INTO d, old_pos FROM public.check_ins WHERE id=_id;
  IF d IS NULL THEN RAISE EXCEPTION 'Check-in não encontrado'; END IF;
  IF old_pos = _new_position THEN RETURN; END IF;

  IF _new_position < old_pos THEN
    UPDATE public.check_ins SET queue_position = queue_position + 1
     WHERE queue_day = d AND queue_position >= _new_position AND queue_position < old_pos AND id <> _id;
  ELSE
    UPDATE public.check_ins SET queue_position = queue_position - 1
     WHERE queue_day = d AND queue_position <= _new_position AND queue_position > old_pos AND id <> _id;
  END IF;
  UPDATE public.check_ins SET queue_position = _new_position, updated_by=auth.uid() WHERE id=_id;

  INSERT INTO public.check_in_events(check_in_id, kind, actor_id, detalhes)
  VALUES (_id, 'reordered', auth.uid(), jsonb_build_object('from', old_pos, 'to', _new_position));
END $$;
