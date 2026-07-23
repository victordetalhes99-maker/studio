import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL!;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(URL, SRK, { auth: { persistSession: false, autoRefreshToken: false } });

const email = "85tattoo@admin.local";
const password = "minhavidatattoo";

// Try to find existing user
const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
let user = list?.users.find((u) => u.email === email);

if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  user = data.user!;
  console.log("created user", user.id);
} else {
  const { error } = await admin.auth.admin.updateUserById(user.id, { password });
  if (error) throw error;
  console.log("updated password for", user.id);
}

const { error: insErr } = await admin
  .from("admins")
  .upsert({ user_id: user.id }, { onConflict: "user_id" });
if (insErr) throw insErr;
console.log("admin row OK for", user.id);
