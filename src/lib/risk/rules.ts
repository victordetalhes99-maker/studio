// ============================================================================
// Regras de Risco — 85 TATTOO
// ----------------------------------------------------------------------------
// Regras versionadas e centralizadas para avaliação da anamnese. Cada regra
// possui ID estável — trocar o texto de uma pergunta não invalida alertas
// antigos. As regras aqui avaliam a estrutura `Anamnese` já existente em
// `src/lib/clientes.ts`; NENHUMA regra faz diagnóstico. A saída é apenas uma
// sinalização de "atenção" ou "alto" para revisão humana.
// ============================================================================

import type { Anamnese } from "@/lib/clientes";

export type RiskSeverity = "attention" | "high";

export type RiskCategory =
  | "medication"
  | "allergy"
  | "coagulation"
  | "cardiovascular"
  | "metabolic"
  | "neurological"
  | "infectious"
  | "dermatologic"
  | "pregnancy"
  | "behavioral"
  | "recovery"
  | "general";

export interface RiskRule {
  /** Identificador estável — usado em URL, exportações e histórico. */
  id: string;
  /** Pergunta de origem na anamnese (chave estável). */
  questionId: keyof Anamnese;
  /** Descrição resumida exibida para operadores. */
  label: string;
  /** Explicação administrativa opcional exibida na revisão. */
  hint?: string;
  category: RiskCategory;
  severity: RiskSeverity;
  /** Versão do catálogo de regras — incremente ao alterar semântica. */
  version: number;
  /** Marcar como false para desativar sem remover histórico. */
  active: boolean;
  /** Condição de ativação. Retorna true quando a resposta configura risco. */
  evaluate: (a: Anamnese) => boolean;
}

const isYes = (v: unknown): v is "sim" => v === "sim";

/**
 * Catálogo de regras — VERSÃO 1.
 * Não remover regras: desative com `active: false` para preservar histórico.
 */
export const RISK_RULES: RiskRule[] = [
  {
    id: "medical-treatment",
    questionId: "tratamentoMedico",
    label: "Em tratamento médico",
    hint: "Cliente relata estar em tratamento médico. Confirme medicamentos e conduta antes do procedimento.",
    category: "medication",
    severity: "attention",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.tratamentoMedico),
  },
  {
    id: "allergy",
    questionId: "alergia",
    label: "Alergia relatada",
    hint: "Verifique substâncias envolvidas e materiais utilizados no atendimento.",
    category: "allergy",
    severity: "attention",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.alergia),
  },
  {
    id: "recent-surgery",
    questionId: "cirurgiaRecente",
    label: "Cirurgia recente",
    hint: "Confira tempo de recuperação e liberação médica.",
    category: "recovery",
    severity: "attention",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.cirurgiaRecente),
  },
  {
    id: "diabetes",
    questionId: "diabetes",
    label: "Diabetes relatada",
    category: "metabolic",
    severity: "attention",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.diabetes),
  },
  {
    id: "pregnancy",
    questionId: "gestante",
    label: "Gestação relatada",
    hint: "Confirme antes de qualquer procedimento invasivo.",
    category: "pregnancy",
    severity: "high",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.gestante),
  },
  {
    id: "hypertension",
    questionId: "hipertensao",
    label: "Hipertensão relatada",
    category: "cardiovascular",
    severity: "attention",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.hipertensao),
  },
  {
    id: "pacemaker",
    questionId: "marcapasso",
    label: "Uso de marcapasso",
    hint: "Alguns equipamentos elétricos podem interferir. Requer conferência prévia.",
    category: "cardiovascular",
    severity: "high",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.marcapasso),
  },
  {
    id: "transmissible-disease",
    questionId: "doencaTransmissivel",
    label: "Doença transmissível relatada",
    hint: "Verifique protocolo de biossegurança específico.",
    category: "infectious",
    severity: "high",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.doencaTransmissivel),
  },
  {
    id: "seizures",
    questionId: "convulsao",
    label: "Histórico de convulsão",
    category: "neurological",
    severity: "high",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.convulsao),
  },
  {
    id: "circulatory",
    questionId: "circulatorio",
    label: "Alteração circulatória relatada",
    category: "cardiovascular",
    severity: "attention",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.circulatorio),
  },
  {
    id: "skin-condition",
    questionId: "problemaPele",
    label: "Problema de pele relatado",
    category: "dermatologic",
    severity: "attention",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.problemaPele),
  },
  {
    id: "anemia",
    questionId: "anemia",
    label: "Anemia relatada",
    category: "metabolic",
    severity: "attention",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.anemia),
  },
  {
    id: "keloid",
    questionId: "queloide",
    label: "Tendência a quelóide",
    category: "dermatologic",
    severity: "attention",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.queloide),
  },
  {
    id: "heart-condition",
    questionId: "cardiopatia",
    label: "Cardiopatia relatada",
    category: "cardiovascular",
    severity: "high",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.cardiopatia),
  },
  {
    id: "hemophilia",
    questionId: "hemofilia",
    label: "Alteração de coagulação relatada",
    hint: "Verifique a ficha clínica e a orientação médica antes do procedimento.",
    category: "coagulation",
    severity: "high",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.hemofilia),
  },
  {
    id: "hepatitis",
    questionId: "hepatite",
    label: "Hepatite relatada",
    category: "infectious",
    severity: "high",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.hepatite),
  },
  {
    id: "depression-anxiety",
    questionId: "depressaoAnsiedade",
    label: "Depressão ou ansiedade relatada",
    hint: "Informação para orientação humanizada. Não é impedimento por si só.",
    category: "behavioral",
    severity: "attention",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.depressaoAnsiedade),
  },
  {
    id: "drugs-alcohol-24h",
    questionId: "drogasAlcool",
    label: "Uso de álcool ou drogas nas últimas 24h",
    hint: "Consumo recente pode interferir no procedimento e na cicatrização.",
    category: "behavioral",
    severity: "attention",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.drogasAlcool),
  },
  {
    id: "not-eaten-24h",
    questionId: "alimentou24h",
    label: "Não se alimentou nas últimas 24h",
    // Nota: pergunta atual é "alimentou-se nas últimas 24h?" — "não" indica atenção.
    hint: "Confirme com o cliente antes do início. Alimentação inadequada pode causar mal-estar.",
    category: "general",
    severity: "attention",
    version: 1,
    active: true,
    evaluate: (a) => a.alimentou24h === "nao",
  },
  {
    id: "recent-tan",
    questionId: "bronzeado",
    label: "Pele bronzeada recente",
    category: "dermatologic",
    severity: "attention",
    version: 1,
    active: true,
    evaluate: (a) => isYes(a.bronzeado),
  },
];

export const RISK_RULES_VERSION = 1;

/** Rótulos amigáveis por categoria. */
export const CATEGORY_LABEL: Record<RiskCategory, string> = {
  medication: "Medicação",
  allergy: "Alergia",
  coagulation: "Coagulação",
  cardiovascular: "Cardiovascular",
  metabolic: "Metabólico",
  neurological: "Neurológico",
  infectious: "Infeccioso",
  dermatologic: "Dermatológico",
  pregnancy: "Gestação",
  behavioral: "Comportamental",
  recovery: "Recuperação",
  general: "Geral",
};

export const SEVERITY_LABEL: Record<RiskSeverity, string> = {
  attention: "Atenção",
  high: "Alto",
};

/** Retorna o motor de avaliação — evita loops fora do módulo. */
export function evaluateAnamnese(a: Anamnese | null | undefined): RiskRuleHit[] {
  if (!a) return [];
  const hits: RiskRuleHit[] = [];
  for (const rule of RISK_RULES) {
    if (!rule.active) continue;
    try {
      if (rule.evaluate(a)) {
        hits.push({
          ruleId: rule.id,
          questionId: rule.questionId,
          label: rule.label,
          category: rule.category,
          severity: rule.severity,
          version: rule.version,
        });
      }
    } catch {
      // regra defeituosa não deve derrubar avaliação
    }
  }
  return hits;
}

export interface RiskRuleHit {
  ruleId: string;
  questionId: keyof Anamnese;
  label: string;
  category: RiskCategory;
  severity: RiskSeverity;
  version: number;
}

/** Deriva o nível agregado do alerta a partir dos motivos. */
export function levelFromHits(hits: RiskRuleHit[]): RiskSeverity | null {
  if (hits.length === 0) return null;
  return hits.some((h) => h.severity === "high") ? "high" : "attention";
}
