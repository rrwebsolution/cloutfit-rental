// Creates an admin account for the dashboard. If the email already exists,
// it resets that account's password and makes sure it is an active admin.
//
//   npm run create-admin -- you@example.com "a-strong-password" "Your Name"
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
// Run the database migration first.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match || line.trim().startsWith("#")) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
      if (!(match[1] in process.env)) process.env[match[1]] = value;
    }
  } catch {
    // File is optional; variables may already be in the environment.
  }
}

loadEnv(".env.local");
loadEnv(".env");

const [email, password, fullName = "Admin"] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !password) {
  console.error('Usage: npm run create-admin -- <email> <password> ["Full Name"]');
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let userId;
const created = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});

if (created.error) {
  if (!/already|registered|exists/i.test(created.error.message)) {
    console.error(`Could not create the user: ${created.error.message}`);
    process.exit(1);
  }
  // The account exists already: find it and promote it instead.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (!profile) {
    console.error("That email is registered in Supabase Auth but has no profile. Was the migration run?");
    process.exit(1);
  }
  userId = profile.id;
  // Re-running the command for an existing account sets the new password,
  // which is how a forgotten or mistyped admin password is fixed.
  const updated = await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
  if (updated.error) {
    console.error(`Could not update the password: ${updated.error.message}`);
    process.exit(1);
  }
  console.log("Account already exists — password updated and admin access confirmed.");
} else {
  userId = created.data.user.id;
}

const { error } = await supabase
  .from("profiles")
  .upsert(
    { id: userId, email: email.toLowerCase(), full_name: fullName, role: "admin", is_active: true },
    { onConflict: "id" },
  );

if (error) {
  console.error(`Could not update the profile: ${error.message}`);
  process.exit(1);
}

console.log(`Admin ready: ${email}. Sign in at /admin/login`);
