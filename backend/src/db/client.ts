import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// SSL rules:
//   railway.internal  → private Railway network, no SSL
//   localhost/127.0.0.1 → local dev Postgres, no SSL
//   everything else (*.proxy.rlwy.net, etc.) → public URL, requires SSL
const noSslHosts = ["railway.internal", "localhost", "127.0.0.1"];
const needsSsl = !noSslHosts.some((h) => process.env.DATABASE_URL!.includes(h));

export const sql = postgres(process.env.DATABASE_URL, {
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,   // fail fast if DB unreachable (seconds)
  // Per-query timeout — a hung upsert won't block forever
  // (postgres.js uses the PostgreSQL `statement_timeout` session variable)
  connection: { statement_timeout: 15000 },
});
