import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../src/lib/supabaseAdmin";

async function main() {
  const rl = readline.createInterface({ input, output });

  const username = (await rl.question("Admin username: ")).trim();
  const password = await rl.question("Admin password: ");
  const confirm = await rl.question("Confirm password: ");

  rl.close();

  if (!username || !password) {
    console.error("Username and password are required.");
    process.exit(1);
  }

  if (password !== confirm) {
    console.error("Passwords do not match.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("users")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();

  if (lookupError) {
    console.error("Lookup failed:", lookupError.message);
    process.exit(1);
  }

  if (existing) {
    console.error(`User "${username}" already exists.`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({ username, password: hash, roles: "admin" })
    .select("user_id, username, roles")
    .single();

  if (error) {
    console.error("Create admin failed:", error.message);
    process.exit(1);
  }

  console.log("Admin created:", data);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
