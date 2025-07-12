//==================================================<Server Setup>====================================================
import express from "express";
import _sodium from "libsodium-wrappers";
import { expressCspHeader, INLINE, NONE, SELF } from "express-csp-header";
import pg from "pg";
import { dirname } from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import "dotenv/config";

const db = new pg.Pool({
  user: "webapp",
  host: "localhost",
  database: "journal_db",
  port: 5432,
  max: 5,
  idleTimeoutMillis: 3000,
  connectionTimeoutMillis: 1000,
});

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

//=====================================================<Functions>====================================================
async function runTransaction(callbackFunction) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await callbackFunction(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function shutdown() {
  console.log("Server is shutting down...");
  try {
    await runTransaction(async (client) => {
      await client.query("DELETE FROM placeholders");
      await client.query(
        "SELECT setval(pg_get_serial_sequence('placeholders', 'index'), 1, false)",
      );
    });
    if (cleaner) {
      clearInterval(cleaner);
    }
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

let cleaning = false;
let cleaner = null;

async function nonceCleaner() {
  cleaner = setInterval(async () => {
    if (cleaning) {
      return;
    }
    cleaning = true;
    let now = new Date();
    try {
      await runTransaction(async (client) => {
        const expired = await client.query(
          "SELECT * FROM nonces WHERE expires_at < $1",
          [now],
        );
        for (const { uid } of expired.rows) {
          await client.query("DELETE FROM nonces WHERE uid = $1", [uid]);
          const authRes = await client.query(
            "SELECT placeholderkey FROM cred_auth WHERE uid = $1",
            [uid],
          );
          if (authRes.rowCount > 0) {
            const placeholderkey = authRes.rows[0].placeholderkey;
            await client.query("DELETE FROM cred_auth WHERE uid = $1", [uid]);
            await client.query(
              "UPDATE placeholders SET ready = true WHERE placeholderkey = $1",
              [placeholderkey],
            );
          }
        }
      });
    } catch (err) {
      console.log(err);
    } finally {
      cleaning = false;
    }
  }, 5000);
}

async function getPlaceholder(index) {
  const placeholder = await runTransaction(async (client) => {
    const pres = await client.query(
      `		WITH combined AS(
			(
				SELECT * FROM placeholders
				WHERE index >= $1
				AND ready = true
				ORDER BY index ASC
				LIMIT 1
			)
			UNION ALL
			(
				SELECT * FROM placeholders
				WHERE index < $1
				AND ready = true
				ORDER BY index ASC
				LIMIT 1
			)
		)
		SELECT * FROM combined	
		LIMIT 1
		FOR UPDATE SKIP LOCKED
	`,
      [index],
    );
    const picked = pres.rows[0];
    if (!picked) {
      throw new Error("No Available Placeholders");
    }
    await client.query(
      "UPDATE placeholders SET ready = false WHERE index = $1",
      [picked.index],
    );
    console.log(picked.placeholderkey);
    return picked.placeholderkey;
  });
  return placeholder;
}

//=====================================================<Routes>=======================================================
app.get("/void", async (req, res) => {});

app.post("/void/write", async (req, res) => {});

app.post("/void/pwdreset", async (req, res) => {});

app.get("/void/regilo", async (req, res) => {
  const uid = req.get("Authorization");
  const intent = req.query.intent;
  try {
    let qres = await db.query("SELECT * FROM cred_auth WHERE uid = $1", [uid]);
    const now = new Date();
    const expiry = new Date(now.getTime() + 30000);

    let challengeID = -1;
    if (intent === "register") {
      challengeID = qres.rowCount === 0 ? 1 : 0;
    } else if (intent === "login" || intent === "write") {
      challengeID = qres.rowCount === 1 ? 2 : 0;
    }

    switch (challengeID) {
      case 0:
        const found = intent === "register" ? 1 : 0;
        return res.json({ found: found });

      case 1:
        let randomVals = await Promise.all([genRandom(), genRandom()]);
        let index = Math.floor(Math.random() * 30) + 1;
        let placeholder = await getPlaceholder(index);
        console.log(placeholder);
        await Promise.all([
          runTransaction(async (client) => {
            await client.query(
              "INSERT INTO cred_auth (uid, salt, apikeyh) VALUES ($1, $2, $3)",
              [uid, randomVals[0][1], placeholder],
            );
          }),
          runTransaction(async (client) => {
            await client.query(
              "INSERT INTO nonces (nonce, uid, intent, expires_at) VALUES ($1, $2, $3, $4)",
              [randomVals[1][1], uid, intent, expiry],
            );
          }),
        ]);
        return res.json({
          found: 0,
          salt: randomVals[0][1],
          nonce: randomVals[1][1],
        });

      case 2:
        await _sodium.ready;
        const sodium = _sodium;
        const nonce = await genRandom();
        await runTransaction(async (client) => {
          await client.query(
            "INSERT INTO nonces (nonce, uid, intent, expires_at) VALUES ($1, $2, $3, $4)",
            [nonce[1], uid, intent, expiry],
          );
        });
        return res.json({
          found: 1,
          salt: qres.rows[0].salt,
          nonce: nonce[1],
        });

      case -1:
      default:
        throw new Error("Unexpected State Reached");
        break;
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/void/gin", async (req, res) => {
  const nonce = req.body.nonce;
  const hmac = req.body.hmac;
  const now = new Date();

  try {
    const checkReq = await Promise.all([
      runTransaction(async (client) => {
        const checkReqQres = await client.query(
          `DELETE FROM nonces
	USING cred_auth
	WHERE nonces.uid = cred_auth.uid
	AND nonces.nonce = $1
	AND nonces.intent = 'login'
	AND nonces.expires_at > $2
	RETURNING nonces.*, cred_auth.*`,
          [nonce, now],
        );
        return checkReqQres;
      }),
      _sodium.ready,
    ]);

    if (checkReq[0].rowCount === 1) {
      const sodium = _sodium;
      const result = checkReq[0].rows[0];
      const hmacUint = sodium.from_base64(hmac);
      const nonceUint = sodium.from_base64(nonce);
      const apikeyhUint = sodium.from_base64(result.apikeyh);
      const valid = sodium.crypto_auth_verify(hmacUint, apikeyhUint, nonceUint);
      if (valid === true) {
        const keyMap = await db.query(
          "Select * FROM api_auth WHERE apikeyh = $1",
          [result.apikeyh],
        );
        const token = jwt.sign(
          {
            sub: keyMap.rows[0].enckeyh,
            iat: Date.now(),
            exp: Date.now() + 600000,
          },
          result.intent === "write" ? process.env.WRITE : process.env.READ,
          { algorithm: HS256 },
        );
        return res.json({ verified: 1, token: token });
      } else {
        return res.json({ verified: 0 });
      }
    } else if (checkReq[0].rowCount === 0) {
      res.json({ verified: 0 });
    } else {
      throw new Error(
        "Weird value returned from login query: \n" +
          JSON.stringify(checkReq[0]),
      );
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/void/ster", async (req, res) => {
  const nonce = req.body.nonce;
  const apikeyh = req.body.apikeyh;
  const enckeyh = req.body.enckeyh;
  const now = new Date();

  try {
    const checkReq = await runTransaction(async (client) => {
      const checkReqQres = await client.query(
        `DELETE FROM nonces
	USING cred_auth
	WHERE nonces.uid = cred_auth.uid
	AND nonces.nonce = $1
	AND nonces.intent = 'register'
	AND nonces.expires_at > $2
	RETURNING nonces.*, cred_auth.*`,
        [nonce, now],
      );
      return checkReqQres;
    });

    if (checkReq.rowCount === 1) {
      await runTransaction(async (client) => {
        const placeholderRes = await client.query(
          "SELECT apikeyh FROM cred_auth WHERE uid = $1",
          [checkReq.rows[0].uid],
        );
        const placeholder = placeholderRes.rows[0].apikeyh;
        await client.query(
          "UPDATE placeholders SET ready = true WHERE placeholderkey = $1",
          [placeholder],
        );
        await client.query("UPDATE cred_auth SET apikeyh = $1 WHERE uid = $2", [
          apikeyh,
          checkReq.rows[0].uid,
        ]);
        await client.query(
          "INSERT INTO api_auth (apikeyh, enckeyh) VALUES ($1, $2)",
          [apikeyh, enckeyh],
        );
      });
      const token = jwt.sign(
        {
          sub: enckeyh,
          iat: Date.now(),
          exp: Date.now() + 600000,
        },
        process.env.READ,
        { algorithm: HS256 },
      );
      return res.json({ verified: 1, token: token });
    } else if (checkReq.rowCount === 0) {
      return res.json({ verified: 0 });
    } else {
      throw new Error(
        "Weird value returned from registration query: \n" +
          JSON.stringify(checkReq),
      );
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

//================================================<Server Start and End>==============================================
app.listen(webPort, async () => {
  let placeholder = [];
  for (let i = 0; i < 30; i++) {
    let newph = await genRandom();
    placeholder.push(newph[1]);
  }
  await db.query(
    "INSERT INTO placeholders (placeholderkey, ready) SELECT value, true FROM UNNEST($1::text[]) AS value",
    [placeholder],
  );
  process.env.READ = (await genRandom())[1];
  process.env.WRITE = (await genRandom())[1];
  await nonceCleaner();
  console.log(`Active on port ${webPort}`);
});

process.on("SIGINT", async () => await shutdown());
process.on("SIGTERM", async () => await shutdown());
