import { clockOutEmployee } from "./src/lib/database.ts";
import { supabase } from "./src/lib/supabase.ts";

async function run() {
  const { data, error } = await supabase.from("clock_sessions").select("*").limit(1);
  console.log("Can read:", data, error);
}

run();
