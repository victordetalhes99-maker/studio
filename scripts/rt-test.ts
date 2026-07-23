import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL!;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY!;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const stamp = Date.now();
const adminEmail = `rt-admin-${stamp}@example.com`;
const userEmail = `rt-user-${stamp}@example.com`;
const password = "Test123456!";

const admin = createClient(URL, SRK, { auth: { persistSession: false, autoRefreshToken: false } });

async function makeUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

function signedClient() {
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signIn(c: ReturnType<typeof signedClient>, email: string) {
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  c.realtime.setAuth(data.session!.access_token);
}

function subscribe(c: ReturnType<typeof signedClient>, label: string, bucket: string[]) {
  return new Promise<void>((resolve) => {
    c.channel(`rt-${label}-${stamp}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, (payload) => {
        const cpf = payload.new?.cpf ?? payload.old?.cpf ?? "?";
        const hasData = !!(payload.new?.cpf || payload.old?.cpf);
        const errs = payload.errors ? ` errors=${JSON.stringify(payload.errors)}` : "";
        bucket.push(`${payload.eventType} cpf=${cpf} hasData=${hasData}${errs}`);
        console.log(
          `[${label}] event:`,
          payload.eventType,
          "cpf=",
          cpf,
          "hasData=",
          hasData,
          "errors=",
          payload.errors,
          "newKeys=",
          Object.keys(payload.new || {}),
          "oldKeys=",
          Object.keys(payload.old || {}),
        );
      })
      .subscribe((status) => {
        console.log(`[${label}] subscribe status:`, status);
        if (status === "SUBSCRIBED") resolve();
      });
  });
}

(async () => {
  console.log("Creating users…");
  const adminId = await makeUser(adminEmail);
  const userId = await makeUser(userEmail);
  console.log("admin id:", adminId);
  console.log("user  id:", userId);

  // Insert admin into admins table (service role)
  const { error: aErr } = await admin.from("admins").insert({ user_id: adminId });
  if (aErr) throw aErr;
  console.log("admin row inserted");

  const adminClient = signedClient();
  const userClient = signedClient();
  await signIn(adminClient, adminEmail);
  await signIn(userClient, userEmail);
  console.log("both signed in");

  const adminEvents: string[] = [];
  const userEvents: string[] = [];
  await Promise.all([
    subscribe(adminClient, "ADMIN", adminEvents),
    subscribe(userClient, "USER ", userEvents),
  ]);
  console.log("both subscribed; waiting 1s before insert");
  await new Promise((r) => setTimeout(r, 3000));

  const testCpf = String(stamp).padStart(11, "0").slice(-11);
  const { error: iErr } = await admin.from("clientes").insert({
    cpf: testCpf,
    nome_completo: "Realtime Test",
    dados_cadastrais: { nomeCompleto: "Realtime Test", cpf: testCpf },
    anamnese: {},
    sessoes: [],
    status: "aguardando",
  });
  if (iErr) throw iErr;
  console.log("clientes row inserted, cpf=", testCpf);

  // Wait for propagation
  await new Promise((r) => setTimeout(r, 8000));

  console.log("\n===== RESULTS =====");
  console.log("ADMIN events:", adminEvents.length, adminEvents);
  console.log("USER  events:", userEvents.length, userEvents);
  const ok = adminEvents.length >= 1 && userEvents.length === 0;
  console.log(
    ok ? "\n✅ PASS — only admin received events" : "\n❌ FAIL — leakage or admin missed event",
  );

  // Cleanup
  await admin.from("clientes").delete().eq("cpf", testCpf);
  await admin.auth.admin.deleteUser(adminId);
  await admin.auth.admin.deleteUser(userId);
  console.log("cleanup done");
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
