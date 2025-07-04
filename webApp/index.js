import express from "express";
import _sodium from "libsodium-wrappers";
import { expressCspHeader, INLINE, NONE, SELF } from "express-csp-header";
import pg from "pg";
import { dirname } from "path";
import { fileURLToPath } from "url";

const db = new pg.Pool({
  user: "webapp",
  host: "localhost",
  database: "journal_db",
  port: 5432,
  max: 5,
  idleTimeoutMillis: 3000,
  connectionTimeoutMillis: 1000,
});

async function shutdown() {
  console.log("Server is shutting down...");
  try {
    await db.query("DELETE FROM placeholders");
    await db.query(
      "SELECT setval(pg_get_serial_sequence('placeholders', 'index'), 1, false)",
    );
    await db.end();
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
  process.exit(0);
}

async function genRandom() {
  await _sodium.ready;
  const sodium = _sodium;

  const randomUint = sodium.randombytes_buf(32);
  return [randomUint, sodium.to_base64(randomUint)];
}

const app = express();
const webPort = 3000;
const _dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.json());
app.use(express.static(_dirname + "/public"));
app.use(
  expressCspHeader({
    directives: {
      "default-src": [SELF],
      "script-src": [SELF],
      "style-src": [SELF],
      "img-src": [SELF],
      "object-src": [SELF],
    },
  }),
);

app.get("/void", (req, res) => {
  res.send("Hello World!");
});

app.post("/void/regilo", async (req, res) => {
  //query req.email and send res = {salt, nonce}
  const uid = req.body.uid;
  const intent = req.body.intent;
  try {
    let qres = await db.query("SELECT * FROM cred_auth WHERE uid = $1", [uid]);
    if (qres.rowCount === 0 && intent === "register") {
      //generate salt, nonce and create entry in nonce table and cred_auth table
      let randomVals = await Promise.all([genRandom(), genRandom()]);
      let index = Math.floor(Math.random() * 10) + 1;
      let placeholder = await db.query(
        "SELECT * FROM placeholders WHERE index = $1",
        [index],
      );
      const now = new Date();
      const expiry = new Date(now.getTime() + 30000);
      await Promise.all([
        db.query(
          "INSERT INTO cred_auth (uid, salt, apikeyh) VALUES ($1, $2, $3)",
          [uid, randomVals[0][1], placeholder],
        ),
        db.query(
          "INSERT INTO nonces (nonce, apikeyh, intent, expires_at) VALUES ($1, $2, $3, $4)",
          [randomVals[1], placeholder, intent, expiry],
        ),
      ]);
      res.json({ found: 0, salt: randomVals[0][1], nonce: randomVals[1][1] });
    } else if (qres.rowCount === 1 && intent === "login") {
      //get salt from result, generate nonce and send both
      await _sodium.ready;
      const sodium = _sodium;
      const nonce = await genRandom();
      const now = new Date();
      const expiry = new Date(now.getTime() + 30000);
      await db.query(
        "INSERT INTO nonces (nonce, apikeyh, intent, expires_at) VALUES ($1, $2, $3, $4)",
        [nonce[1], qres.rows[0].apikeyh, intent, expiry],
      );
      res.json({ found: 1, salt: qres.rows[0].salt, nonce: nonce[1] });
    } else if (qres.rowCount === 0 && intent === "login") {
      res.json({ found: 0 });
    } else if (qres.rowCount === 1 && intent === "register") {
      res.json({ found: 1 });
    } else {
      throw Error.message("Unexpected State Reached");
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/void/gin", (req, res) => {});

app.listen(webPort, async () => {
  let placeholder = [];
  for (let i = 0; i < 10; i++) {
    let newph = await genRandom();
    placeholder.push(newph[1]);
  }
  await db.query(
    "INSERT INTO placeholders (placeholderkey) SELECT * FROM UNNEST($1::text[])",
    [placeholder],
  );
  console.log(`Active on port ${webPort}`);
});

process.on("SIGINT", async () => await shutdown());
process.on("SIGTERM", async () => await shutdown());
