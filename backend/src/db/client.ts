import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Railway internal Postgres (postgres.railway.internal) runs on a private
// network and does not use SSL. External/public URLs (*.proxy.rlwy.net) do.
const needsSsl =
  process.env.DATABASE_URL.includes("railway.internal") === false;

export const sql = postgres(process.env.DATABASE_URL, {
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idle_timeout: 30,
});
