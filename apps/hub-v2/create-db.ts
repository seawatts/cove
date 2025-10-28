import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';

const dbPath = './data/hub.db';
const db = new Database(dbPath);

const sql = readFileSync('./drizzle/0000_busy_terror.sql', 'utf-8');

console.log('Creating database schema...');
// Split by statement-breakpoint and execute each statement
const statements = sql
  .split('--> statement-breakpoint')
  .filter((s) => s.trim());
for (const statement of statements) {
  const trimmed = statement.trim();
  if (trimmed) {
    db.run(trimmed);
  }
}
console.log('Database created successfully at', dbPath);

db.close();
