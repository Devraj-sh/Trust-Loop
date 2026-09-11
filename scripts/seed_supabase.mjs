import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env", "utf-8");
const url = env.match(/SUPABASE_URL="([^"]+)"/)?.[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)?.[1];

const supabase = createClient(url, key, {
  auth: { persistSession: false },
  global: {
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    }
  }
});

async function seed() {
  console.log("Seeding unique orders into Supabase...");
  const orders = JSON.parse(fs.readFileSync("./src/lib/trustloop/data/orders_sample.json"));
  const batchSize = 300;
  let successCount = 0;

  for (let i = 0; i < orders.length; i += batchSize) {
    const chunk = orders.slice(i, i + batchSize).map(o => {
      const { customers: _, ...clean } = o;
      return clean;
    });
    const { error: ordErr } = await supabase.from("orders").upsert(chunk, { onConflict: "external_id" });
    if (ordErr) {
      console.error(`Orders chunk ${i} error:`, ordErr.message);
    } else {
      successCount += chunk.length;
      console.log(`Orders successfully inserted: ${successCount} / ${orders.length}`);
    }
  }

  console.log("Checking final counts in Supabase...");
  const [catRes, custRes, ordRes] = await Promise.all([
    supabase.from("product_categories").select("*", { count: "exact", head: true }),
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }),
  ]);

  console.log({
    categories: catRes.count,
    customers: custRes.count,
    orders: ordRes.count
  });
}

seed();
