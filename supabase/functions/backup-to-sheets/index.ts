import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GOOGLE_SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ENABLE_GOOGLE_SHEETS_BACKUP = Deno.env.get("ENABLE_GOOGLE_SHEETS_BACKUP") === "true";

const SHEETS_HEADERS = {
  Authorization: `Bearer ${LOVABLE_API_KEY}`,
  "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
  "Content-Type": "application/json",
};

const CONFIG_KEY = "backup_spreadsheet_id";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue | undefined };

interface DadosCadastrais extends JsonObject {
  dataNascimento?: string;
  data_nascimento?: string;
  genero?: string;
  rg?: string;
  endereco?: string;
  comoConheceu?: string;
}

interface AnamneseData extends JsonObject {
  tipoSanguineo?: string;
  alergiaDesc?: string;
  cirurgiaDesc?: string;
  diabetesDesc?: string;
  doencaTransmissivelDesc?: string;
  problemaPeleDesc?: string;
}

interface SessaoData extends JsonObject {
  data?: string | null;
}

interface Cliente {
  cpf: string;
  nome_completo: string;
  telefone: string | null;
  email: string | null;
  tatuador: string | null;
  status: string;
  criado_em: string;
  atualizado_em: string;
  dados_cadastrais: DadosCadastrais | null;
  anamnese: AnamneseData | null;
  sessoes: SessaoData[] | null;
}

type ClienteRow = {
  cpf: string;
  nome_completo: string;
  telefone: string | null;
  email: string | null;
  tatuador: string | null;
  status: string;
  criado_em: string;
  atualizado_em: string;
  dados_cadastrais: JsonValue;
  anamnese: JsonValue;
  sessoes: JsonValue;
};

interface BackupDatabase {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      app_config: {
        Row: { key: string; value: string | null; atualizado_em: string };
        Insert: { key: string; value?: string | null; atualizado_em?: string };
        Update: { key?: string; value?: string | null; atualizado_em?: string };
        Relationships: [];
      };
      clientes: {
        Row: ClienteRow;
        Insert: ClienteRow;
        Update: Partial<ClienteRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: never; Returns: boolean };
      register_backup_log: {
        Args: {
          _status: "success" | "error";
          _mensagem: string;
          _spreadsheet_id: string | null;
          _spreadsheet_url: string | null;
          _csv_tab: string | null;
          _total_clientes: number | null;
          _duracao_ms: number | null;
          _detalhes: JsonObject;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

type BackupSupabaseClient = SupabaseClient<BackupDatabase>;

// Paleta — preto/dourado Premium Ink
const GOLD = { red: 0.78, green: 0.6, blue: 0.27 };
const GOLD_DARK = { red: 0.58, green: 0.43, blue: 0.16 };
const GOLD_SOFT = { red: 0.97, green: 0.92, blue: 0.82 };
const BLACK = { red: 0.08, green: 0.08, blue: 0.08 };
const WHITE = { red: 1, green: 1, blue: 1 };
const CREAM = { red: 0.99, green: 0.97, blue: 0.93 };
const RISK_BG = { red: 1, green: 0.93, blue: 0.93 };

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function tabName(): string {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dia}-${mes}-${ano} ${hora}h${min}`;
}

function yn(v: unknown): string {
  if (v === "sim" || v === true) return "Sim";
  if (v === "nao" || v === false) return "Não";
  return "—";
}

const ANAMNESE_FIELDS: Array<{ key: string; label: string; risk?: boolean }> = [
  { key: "tratamentoMedico", label: "Tratamento médico" },
  { key: "alergia", label: "Alergia", risk: true },
  { key: "cirurgiaRecente", label: "Cirurgia recente" },
  { key: "diabetes", label: "Diabetes", risk: true },
  { key: "gestante", label: "Gestante" },
  { key: "hipertensao", label: "Hipertensão" },
  { key: "marcapasso", label: "Marcapasso" },
  { key: "doencaTransmissivel", label: "Doença transmissível" },
  { key: "convulsao", label: "Convulsão" },
  { key: "circulatorio", label: "Problema circulatório" },
  { key: "problemaPele", label: "Problema de pele" },
  { key: "fumante", label: "Fumante" },
  { key: "alimentou24h", label: "Alimentou-se (24h)" },
  { key: "drogasAlcool", label: "Drogas / Álcool" },
  { key: "bronzeado", label: "Bronzeado" },
  { key: "depressaoAnsiedade", label: "Depressão / Ansiedade" },
  { key: "anemia", label: "Anemia" },
  { key: "queloide", label: "Queloide" },
  { key: "cardiopatia", label: "Cardiopatia", risk: true },
  { key: "hemofilia", label: "Coagulopatia / Hemofilia", risk: true },
  { key: "hepatite", label: "Hepatite" },
  { key: "vitiligo", label: "Vitiligo" },
];

const BASE_HEADERS = [
  "CPF",
  "Nome completo",
  "Data nasc.",
  "Gênero",
  "RG",
  "Telefone",
  "Email",
  "Endereço",
  "Como conheceu",
  "Tatuador",
  "Status",
  "Sessões",
  "Última sessão",
  "Cadastro",
  "Atualizado em",
  "Tipo sang.",
  "Riscos clínicos",
  "Observações",
];

const ALL_HEADERS = [...BASE_HEADERS, ...ANAMNESE_FIELDS.map((f) => f.label)];
const TOTAL_COLS = ALL_HEADERS.length;

function getRiscos(a: AnamneseData | null): string[] {
  if (!a) return [];
  return ANAMNESE_FIELDS.filter((f) => f.risk && a[f.key] === "sim").map((f) => f.label);
}

function buildObs(a: AnamneseData | null): string {
  if (!a) return "";
  const obs: string[] = [];
  if (a.alergiaDesc) obs.push(`Alergia: ${a.alergiaDesc}`);
  if (a.cirurgiaDesc) obs.push(`Cirurgia: ${a.cirurgiaDesc}`);
  if (a.diabetesDesc) obs.push(`Diabetes: ${a.diabetesDesc}`);
  if (a.doencaTransmissivelDesc) obs.push(`Doença: ${a.doencaTransmissivelDesc}`);
  if (a.problemaPeleDesc) obs.push(`Pele: ${a.problemaPeleDesc}`);
  return obs.join(" | ");
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredStringField(value: unknown, field: string): string {
  if (!isJsonObject(value) || typeof value[field] !== "string" || value[field].length === 0) {
    throw new Error(`Resposta invalida do Google Sheets: campo ${field} ausente`);
  }
  return value[field];
}

function addedSheetId(value: unknown): number {
  if (!isJsonObject(value) || !Array.isArray(value.replies)) {
    throw new Error("Resposta invalida do Google Sheets: replies ausente");
  }
  const firstReply = value.replies[0];
  if (!isJsonObject(firstReply) || !isJsonObject(firstReply.addSheet)) {
    throw new Error("Resposta invalida do Google Sheets: addSheet ausente");
  }
  const properties = firstReply.addSheet.properties;
  if (!isJsonObject(properties) || typeof properties.sheetId !== "number") {
    throw new Error("Resposta invalida do Google Sheets: sheetId ausente");
  }
  return properties.sheetId;
}

async function sheetsRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: { ...SHEETS_HEADERS, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Sheets API ${res.status}: ${text}`);
  }
  return text ? (JSON.parse(text) as unknown) : {};
}

async function getOrCreateSpreadsheet(supabase: BackupSupabaseClient): Promise<string> {
  const { data: existing } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", CONFIG_KEY)
    .maybeSingle();

  if (existing?.value) {
    try {
      await sheetsRequest(`/spreadsheets/${existing.value}?fields=spreadsheetId`);
      return existing.value;
    } catch (e) {
      console.warn("Planilha anterior inacessível, criando nova:", e);
    }
  }

  const created = await sheetsRequest("/spreadsheets", {
    method: "POST",
    body: JSON.stringify({
      properties: { title: "Backup Premium Ink" },
      sheets: [{ properties: { title: "Leia-me" } }],
    }),
  });

  const id = requiredStringField(created, "spreadsheetId");

  await sheetsRequest(`/spreadsheets/${id}/values/Leia-me!A1?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({
      values: [
        ["PREMIUM INK — BACKUP DE CLIENTES"],
        [""],
        ["Esta planilha recebe um backup automático dos clientes a cada 5 dias."],
        ["Cada backup gera uma aba nova com a data e hora do registro."],
        ["Cada aba contém a ficha completa: cadastro, contato, sessões e anamnese."],
        ["Não apague esta aba — ela serve de referência."],
      ],
    }),
  });

  await supabase
    .from("app_config")
    .upsert({ key: CONFIG_KEY, value: id, atualizado_em: new Date().toISOString() });

  return id;
}

async function addTab(spreadsheetId: string, title: string): Promise<number> {
  const result = await sheetsRequest(`/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title,
              gridProperties: {
                rowCount: 2000,
                columnCount: TOTAL_COLS,
                frozenRowCount: 4,
              },
              tabColor: GOLD,
            },
          },
        },
      ],
    }),
  });
  return addedSheetId(result);
}

function buildRows(clientes: Cliente[]): string[][] {
  const total = clientes.length;
  const atendidos = clientes.filter((c) => c.status === "atendido").length;
  const aguardando = total - atendidos;
  const comRisco = clientes.filter((c) => getRiscos(c.anamnese).length > 0).length;

  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const titulo = ["PREMIUM INK — FICHA DE CADASTRO DE CLIENTES", ...Array(TOTAL_COLS - 1).fill("")];
  const subtitulo = [`Backup gerado em ${now}`, ...Array(TOTAL_COLS - 1).fill("")];
  const resumo = [
    `Total: ${total}   •   Atendidos: ${atendidos}   •   Aguardando: ${aguardando}   •   Com riscos clínicos: ${comRisco}`,
    ...Array(TOTAL_COLS - 1).fill(""),
  ];

  const rows: string[][] = [titulo, subtitulo, resumo, ALL_HEADERS];

  clientes.forEach((c) => {
    const sessoes = Array.isArray(c.sessoes) ? c.sessoes : [];
    const dc = c.dados_cadastrais ?? {};
    const a = c.anamnese ?? {};
    const riscos = getRiscos(a);
    const ultimaSessao =
      sessoes.length > 0 ? formatDate(sessoes[sessoes.length - 1]?.data ?? null) : "";

    const base = [
      c.cpf,
      c.nome_completo,
      formatDateOnly(dc.dataNascimento ?? dc.data_nascimento ?? ""),
      dc.genero ?? "",
      dc.rg ?? "",
      c.telefone ?? "",
      c.email ?? "",
      dc.endereco ?? "",
      dc.comoConheceu ?? "",
      c.tatuador ?? "",
      c.status === "atendido" ? "Atendido" : "Aguardando",
      String(sessoes.length),
      ultimaSessao,
      formatDate(c.criado_em),
      formatDate(c.atualizado_em),
      a.tipoSanguineo ?? "",
      riscos.join(", ") || "—",
      buildObs(a),
    ];

    const anamneseCols = ANAMNESE_FIELDS.map((f) => yn(a[f.key]));
    rows.push([...base, ...anamneseCols]);
  });

  return rows;
}

async function formatTab(spreadsheetId: string, sheetId: number, totalRows: number) {
  const colLetter = (idx: number) => {
    let n = idx + 1;
    let s = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  const dataStart = 4;
  const dataEnd = totalRows;
  const anamneseStart = BASE_HEADERS.length;

  const requests: JsonObject[] = [
    // Merges
    {
      mergeCells: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: TOTAL_COLS,
        },
        mergeType: "MERGE_ALL",
      },
    },
    {
      mergeCells: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 2,
          startColumnIndex: 0,
          endColumnIndex: TOTAL_COLS,
        },
        mergeType: "MERGE_ALL",
      },
    },
    {
      mergeCells: {
        range: {
          sheetId,
          startRowIndex: 2,
          endRowIndex: 3,
          startColumnIndex: 0,
          endColumnIndex: TOTAL_COLS,
        },
        mergeType: "MERGE_ALL",
      },
    },
    // Título: preto com dourado
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: BLACK,
            textFormat: { foregroundColor: GOLD, bold: true, fontSize: 18, fontFamily: "Georgia" },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields:
          "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 52 },
        fields: "pixelSize",
      },
    },
    // Subtítulo
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2 },
        cell: {
          userEnteredFormat: {
            backgroundColor: GOLD_DARK,
            textFormat: { foregroundColor: WHITE, italic: true, fontSize: 10 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields:
          "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    // Resumo
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 2, endRowIndex: 3 },
        cell: {
          userEnteredFormat: {
            backgroundColor: CREAM,
            textFormat: { foregroundColor: BLACK, bold: true, fontSize: 11 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields:
          "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 2, endIndex: 3 },
        properties: { pixelSize: 32 },
        fields: "pixelSize",
      },
    },
    // Cabeçalho da tabela
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 3,
          endRowIndex: 4,
          startColumnIndex: 0,
          endColumnIndex: TOTAL_COLS,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: GOLD,
            textFormat: { foregroundColor: WHITE, bold: true, fontSize: 10 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP",
            borders: { bottom: { style: "SOLID_MEDIUM", color: BLACK } },
          },
        },
        fields:
          "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy,borders)",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 3, endIndex: 4 },
        properties: { pixelSize: 46 },
        fields: "pixelSize",
      },
    },
    // Destaque visual: colunas de anamnese com fundo creme suave
    ...(dataEnd > dataStart
      ? [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: dataStart,
                endRowIndex: dataEnd,
                startColumnIndex: anamneseStart,
                endColumnIndex: TOTAL_COLS,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: GOLD_SOFT,
                  textFormat: { fontSize: 10 },
                  horizontalAlignment: "CENTER",
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            },
          },
        ]
      : []),
  ];

  // Banding nos dados base
  if (dataEnd > dataStart) {
    requests.push({
      addBanding: {
        bandedRange: {
          range: {
            sheetId,
            startRowIndex: 3,
            endRowIndex: dataEnd,
            startColumnIndex: 0,
            endColumnIndex: anamneseStart,
          },
          rowProperties: {
            headerColor: GOLD,
            firstBandColor: WHITE,
            secondBandColor: CREAM,
          },
        },
      },
    });
  }

  // Formatação condicional: "Sim" em vermelho nas colunas de risco
  ANAMNESE_FIELDS.forEach((f, i) => {
    if (!f.risk || dataEnd <= dataStart) return;
    const colIdx = anamneseStart + i;
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [
            {
              sheetId,
              startRowIndex: dataStart,
              endRowIndex: dataEnd,
              startColumnIndex: colIdx,
              endColumnIndex: colIdx + 1,
            },
          ],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "Sim" }] },
            format: {
              backgroundColor: { red: 0.86, green: 0.27, blue: 0.27 },
              textFormat: { foregroundColor: WHITE, bold: true },
            },
          },
        },
        index: 0,
      },
    });
  });

  // Destaque vermelho na coluna "Riscos clínicos" quando há risco
  const riscoCol = BASE_HEADERS.indexOf("Riscos clínicos");
  if (dataEnd > dataStart) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [
            {
              sheetId,
              startRowIndex: dataStart,
              endRowIndex: dataEnd,
              startColumnIndex: riscoCol,
              endColumnIndex: riscoCol + 1,
            },
          ],
          booleanRule: {
            condition: {
              type: "CUSTOM_FORMULA",
              values: [{ userEnteredValue: `=$${colLetter(riscoCol)}${dataStart + 1}<>"—"` }],
            },
            format: {
              backgroundColor: RISK_BG,
              textFormat: { foregroundColor: { red: 0.7, green: 0.1, blue: 0.1 }, bold: true },
            },
          },
        },
        index: 0,
      },
    });
  }

  // Destaque status
  const statusCol = BASE_HEADERS.indexOf("Status");
  if (dataEnd > dataStart) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [
            {
              sheetId,
              startRowIndex: dataStart,
              endRowIndex: dataEnd,
              startColumnIndex: statusCol,
              endColumnIndex: statusCol + 1,
            },
          ],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "Atendido" }] },
            format: {
              backgroundColor: { red: 0.85, green: 0.95, blue: 0.85 },
              textFormat: { foregroundColor: { red: 0.1, green: 0.45, blue: 0.2 }, bold: true },
            },
          },
        },
        index: 0,
      },
    });
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [
            {
              sheetId,
              startRowIndex: dataStart,
              endRowIndex: dataEnd,
              startColumnIndex: statusCol,
              endColumnIndex: statusCol + 1,
            },
          ],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "Aguardando" }] },
            format: {
              backgroundColor: { red: 1, green: 0.95, blue: 0.8 },
              textFormat: { foregroundColor: { red: 0.6, green: 0.4, blue: 0.05 }, bold: true },
            },
          },
        },
        index: 0,
      },
    });
  }

  // Formatação das linhas de dados (alinhamento + fonte)
  if (dataEnd > dataStart) {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: dataStart,
          endRowIndex: dataEnd,
          startColumnIndex: 0,
          endColumnIndex: anamneseStart,
        },
        cell: {
          userEnteredFormat: {
            textFormat: { fontSize: 10 },
            verticalAlignment: "MIDDLE",
            wrapStrategy: "CLIP",
          },
        },
        fields: "userEnteredFormat(textFormat,verticalAlignment,wrapStrategy)",
      },
    });
  }

  // Auto-resize todas as colunas
  requests.push({
    autoResizeDimensions: {
      dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: TOTAL_COLS },
    },
  });

  // Largura mínima para colunas de anamnese
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: anamneseStart, endIndex: TOTAL_COLS },
      properties: { pixelSize: 110 },
      fields: "pixelSize",
    },
  });

  // Sheets só aceita ~100 requests por chamada — quebra em lotes
  const chunkSize = 40;
  for (let i = 0; i < requests.length; i += chunkSize) {
    const slice = requests.slice(i, i + chunkSize);
    await sheetsRequest(`/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: slice }),
    });
  }
}

async function registerBackupLog(
  admin: BackupSupabaseClient,
  payload: {
    status: "success" | "error";
    mensagem: string;
    spreadsheetId?: string;
    spreadsheetUrl?: string;
    csvTab?: string;
    totalClientes?: number;
    duracaoMs?: number;
    detalhes?: JsonObject;
  },
) {
  try {
    await admin.rpc("register_backup_log", {
      _status: payload.status,
      _mensagem: payload.mensagem,
      _spreadsheet_id: payload.spreadsheetId ?? null,
      _spreadsheet_url: payload.spreadsheetUrl ?? null,
      _csv_tab: payload.csvTab ?? null,
      _total_clientes: payload.totalClientes ?? null,
      _duracao_ms: payload.duracaoMs ?? null,
      _detalhes: payload.detalhes ?? {},
    });
  } catch (e) {
    console.error("register_backup_log falhou:", e);
  }
}

// Cria uma aba CSV simples (sem formatação) — facilita download em CSV puro pelo admin.
async function addCsvTab(spreadsheetId: string, baseTitle: string, rows: string[][]) {
  const csvTitle = `CSV ${baseTitle}`;
  await sheetsRequest(`/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: csvTitle,
              gridProperties: {
                rowCount: Math.max(rows.length + 5, 100),
                columnCount: TOTAL_COLS,
              },
            },
          },
        },
      ],
    }),
  });
  // Apenas cabeçalhos (linha 4 do dataset) + linhas de dados — nada de título/merge.
  const flat = [ALL_HEADERS, ...rows.slice(4)];
  await sheetsRequest(
    `/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(csvTitle)}!A1?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values: flat }) },
  );
  return csvTitle;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const admin = createClient<BackupDatabase>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (!ENABLE_GOOGLE_SHEETS_BACKUP) {
      return new Response(JSON.stringify({ error: "Integracao desabilitada por politica." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!LOVABLE_API_KEY || !GOOGLE_SHEETS_API_KEY) {
      throw new Error("Credenciais do Google Sheets não configuradas");
    }

    const authHeader = req.headers.get("Authorization");
    const cronToken = req.headers.get("x-cron-token");

    let isCron = false;
    if (cronToken) {
      const { data: cfg } = await admin
        .from("app_config")
        .select("value")
        .eq("key", "cron_token")
        .maybeSingle();
      isCron = !!cfg?.value && cfg.value === cronToken;
    }

    if (!isCron) {
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient<BackupDatabase>(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claims?.claims) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin } = await userClient.rpc("is_admin");
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Apenas administradores" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: clientes, error } = await admin
      .from("clientes")
      .select(
        "cpf,nome_completo,telefone,email,tatuador,status,criado_em,atualizado_em,dados_cadastrais,anamnese,sessoes",
      )
      .order("criado_em", { ascending: false });

    if (error) throw error;

    const spreadsheetId = await getOrCreateSpreadsheet(admin);
    const title = tabName();
    const sheetId = await addTab(spreadsheetId, title);

    const rows = buildRows((clientes ?? []) as Cliente[]);

    await sheetsRequest(
      `/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(title)}!A1?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        body: JSON.stringify({ values: rows }),
      },
    );

    await formatTab(spreadsheetId, sheetId, rows.length);

    // Aba CSV "puro" (sem formatação) — pronta para File → Download → CSV
    let csvTab: string | undefined;
    try {
      csvTab = await addCsvTab(spreadsheetId, title, rows);
    } catch (e) {
      console.warn("Falha ao gerar aba CSV (não-fatal):", e);
    }

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    const total = clientes?.length ?? 0;
    const duracao = Date.now() - startedAt;

    await registerBackupLog(admin, {
      status: "success",
      mensagem: `Backup gerado com ${total} cliente(s) na aba "${title}".`,
      spreadsheetId,
      spreadsheetUrl: url,
      csvTab,
      totalClientes: total,
      duracaoMs: duracao,
      detalhes: { trigger: isCron ? "cron" : "manual" },
    });

    return new Response(
      JSON.stringify({
        success: true,
        spreadsheetId,
        url,
        tab: title,
        csvTab,
        totalClientes: total,
        duracaoMs: duracao,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("backup-to-sheets error:", err);
    await registerBackupLog(admin, {
      status: "error",
      mensagem,
      duracaoMs: Date.now() - startedAt,
      detalhes: { stack: err instanceof Error ? err.stack?.slice(0, 2000) : null },
    });
    return new Response(JSON.stringify({ error: mensagem }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
