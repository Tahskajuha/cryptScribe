//==================================================<Server Setup>==================================================== import express from "express";
import _sodium from "libsodium-wrappers";
import { expressCspHeader, INLINE, NONE, SELF } from "express-csp-header";
import pg from "pg";
import { dirname } from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { writeFile, readFile, unlink } from "fs/promises";
import { Resend } from "resend";

const db = new pg.Pool({
  user: process.env.USER,
  host: "db",
  password: process.env.PWD,
  database: process.env.NAME,
  port: process.env.DBPORT,
  max: 5,
  idleTimeoutMillis: 3000,
  connectionTimeoutMillis: 1000,
});

const app = express();
const _dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.json());
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

let resend = null;
let enablePWDReset = false;
if (process.env.RESENDAPI && process.env.EMAILFROM) {
  try {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.EMAILFROM)) {
      throw new Error("Invalid Email!");
    }
    resend = new Resend(process.env.RESENDAPI);
    enablePWDReset = true;
  } catch (err) {
    console.log(err);
  }
}

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
      await client.query("DELETE FROM journal.placeholders");
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
        for (const { uid, intent } of expired.rows) {
          await client.query("DELETE FROM nonces WHERE uid = $1", [uid]);
          if (intent === "register") {
            const authRes = await client.query(
              "SELECT apikeyh FROM cred_auth WHERE uid = $1",
              [uid],
            );
            if (authRes.rowCount > 0) {
              const placeholderkey = authRes.rows[0].apikeyh;
              await client.query("DELETE FROM cred_auth WHERE uid = $1", [uid]);
              await client.query(
                "UPDATE placeholders SET ready = true WHERE placeholderkey = $1",
                [placeholderkey],
              );
            }
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
    return picked.placeholderkey;
  });
  return placeholder;
}

//=====================================================<Routes>=======================================================
app.get("/void", (req, res) => {
  return res.sendStatus(200);
});

app.get("/void/read", async (req, res) => {
  const token = req.get("Authorization");
  try {
    const decoded = jwt.verify(token, process.env.READ);
    const userData = await readFile(
      `${_dirname}/userData/${decoded.sub}`,
      "utf8",
    );
    return res.status(200).json(JSON.parse(userData));
  } catch (err) {
    switch (err.name) {
      case "TokenExpiredError":
      case "JsonWebTokenError":
      case "NotBeforeError":
        return res.sendStatus(401);
      default:
        console.log(err);
        return res.sendStatus(500);
    }
  }
});

app.post("/void/write", async (req, res) => {
  const token = req.get("Authorization");
  try {
    const decoded = jwt.verify(token, process.env.WRITE);
    await writeFile(
      `${_dirname}/userData/${decoded.sub}`,
      req.body.udata,
      "utf8",
    );
    return res.status(200).end();
  } catch (err) {
    switch (err.name) {
      case "TokenExpiredError":
      case "JsonWebTokenError":
      case "NotBeforeError":
        console.log(err);
        return res.sendStatus(401);
      default:
        console.log(err);
        return res.sendStatus(500);
    }
  }
});

if (enablePWDReset) {
  app.get("/void/reqpwdreset", async (req, res) => {
    const uid = req.get("EmailID");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(uid)) {
      return res.sendStatus(401);
    }
    const sodium = await _sodium.ready;
    const hash = sodium.to_base64(sodium.crypto_generichash(16, uid));
    try {
      const qres = await db.query("SELECT * FROM cred_auth WHERE uid = $1", [
        hash,
      ]);
      if (qres.rowCount !== 1) {
        return res.sendStatus(401);
      }
      const token = jwt.sign(
        {
          sub: hash,
        },
        process.env.RESETKEY,
        { algorithm: "HS256", expiresIn: "10m" },
      );
      const mailContent = `<p align="center"> Paste this token in your app to initiate password reset</p><pre align="center">${token}</pre>`;
      const { data, error } = await resend.emails.send({
        from: process.env.EMAILFROM,
        to: [uid],
        subject: "Password Reset Token",
        html: mailContent,
      });
      if (error) {
        throw error;
      }
      return res.status(200).json({ salt: qres.rows[0].salt });
    } catch (err) {
      console.log(err);
      return res.sendStatus(500);
    }
  });
  app.post("/void/pwdreset", async (req, res) => {
    const token = req.get("Authorization");
    const apikeyh = req.body.apikeyh;
    try {
      const decoded = jwt.verify(token, process.env.RESETKEY);
      const uid = decoded.sub;
      await runTransaction(async (client) => {
        const qres = await client.query(
          "SELECT * FROM cred_auth WHERE uid = $1",
          [uid],
        );
        if (qres.rowCount !== 1) {
          return res.sendStatus(401);
        }
        await client.query(
          "UPDATE api_auth SET apikeyh = $1 WHERE apikeyh = $2",
          [apikeyh, qres.rows[0].apikeyh],
        );
        await client.query("UPDATE cred_auth SET apikeyh = $1 WHERE uid = $2", [
          apikeyh,
          uid,
        ]);
      });
      return res.sendStatus(200);
    } catch (err) {
      switch (err.name) {
        case "TokenExpiredError":
        case "JsonWebTokenError":
        case "NotBeforeError":
          console.log(err);
          return res.sendStatus(401);
        default:
          console.log(err);
          return res.sendStatus(500);
      }
    }
  });
}

app.post("/void/encreset", async (req, res) => {
  const token = req.get("Authorization");
  const enckeyh = req.body.enckeyh;
  try {
    const decoded = jwt.verify(token, process.env.RESETKEY);
    const filePath = `${_dirname}/userData/${decoded.sub}`;
    const userData = await readFile(filePath, "utf8");
    await unlink(filePath);
    await runTransaction(async (client) => {
      await client.query("DELETE FROM entries WHERE enckeyh = $1", [
        decoded.sub,
      ]);
      await client.query(
        "UPDATE api_auth SET enckeyh = $2 WHERE enckeyh = $1",
        [decoded.sub, enckeyh],
      );
    });
    const userInit = { enckeyh: enckeyh };
    await writeFile(
      `${_dirname}/userData/${enckeyh}`,
      JSON.stringify(userInit),
      "utf8",
    );
    return res.status(200).json(JSON.parse(userData));
  } catch (err) {
    switch (err.name) {
      case "TokenExpiredError":
      case "JsonWebTokenError":
      case "NotBeforeError":
        return res.sendStatus(401);
      default:
        console.log(err);
        return res.sendStatus(500);
    }
  }
});

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
    } else if (intent === "login" || intent === "write" || intent === "reset") {
      challengeID = qres.rowCount === 1 ? 2 : 0;
    } else {
      return res.status(401).end();
    }

    switch (challengeID) {
      case 0:
        return res.status(402).end();

      case 1:
        let randomVals = await Promise.all([genRandom(), genRandom()]);
        let index = Math.floor(Math.random() * 30) + 1;
        let placeholder = await getPlaceholder(index);
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
        return res.status(201).json({
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
        return res.status(201).json({
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
	AND (nonces.intent = 'login' OR nonces.intent = 'write')
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
      if (valid) {
        const keyMap = await db.query(
          "Select * FROM api_auth WHERE apikeyh = $1",
          [result.apikeyh],
        );
        const token = jwt.sign(
          {
            sub: keyMap.rows[0].enckeyh,
          },
          result.intent === "reset"
            ? process.env.RESETKEY
            : result.intent === "write"
              ? process.env.WRITE
              : process.env.READ,
          { algorithm: "HS256", expiresIn: "10m" },
        );
        return res.status(200).json({ token: token });
      } else {
        return res.status(402).end();
      }
    } else if (checkReq[0].rowCount === 0) {
      return res.status(402).end();
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
      const userInit = { enckeyh: enckeyh };
      await writeFile(
        `${_dirname}/userData/${enckeyh}`,
        JSON.stringify(userInit),
        "utf8",
      );
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
        },
        process.env.READ,
        { algorithm: "HS256", expiresIn: "10m" },
      );
      return res.status(201).json({ token: token });
    } else if (checkReq.rowCount === 0) {
      return res.status(402).end;
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
app.listen(process.env.PORT, "0.0.0.0", async () => {
  await db.query("SET search_path TO journal");
  let placeholder = [];
  for (let i = 0; i < 30; i++) {
    let newph = await genRandom();
    placeholder.push(newph[1]);
  }
  await runTransaction((client) => {
    client.query(
      "INSERT INTO placeholders (placeholderkey, ready) SELECT value, true FROM UNNEST($1::text[]) AS value",
      [placeholder],
    );
  });
  process.env.READ = (await genRandom())[1];
  process.env.WRITE = (await genRandom())[1];
  process.env.RESETKEY = (await genRandom())[1];
  await nonceCleaner();
  console.log(`Active on port ${webPort}`);
});

process.on("SIGINT", async () => await shutdown());
process.on("SIGTERM", async () => await shutdown());
