import { createAdminSupabaseClient } from "@/lib/supabase/admin";

async function main() {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("purge_prayer_storage");
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

void main();
