// Usage: npx tsx src/db/migrate.ts
// Applies schema.sql to the connected database.
// Requires DATABASE_URL environment variable.

import { sql } from './client.js';
import fs from 'fs';
import path from 'path';

const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

async function main() {
  console.log('Running schema migration...');
  await sql.unsafe(schema);
  console.log('Done.');
  await sql.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
