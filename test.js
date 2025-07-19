import pg from "pg";

const db = new pg.Pool({
  user: "webapp",
  host: "localhost",
  database: "journal_db",
  port: 5432,
  max: 5,
  idleTimeoutMillis: 3000,
  connectionTimeoutMillis: 1000,
});

const res = await db.query("SELECT * FROM placeholders");

console.log(res);
