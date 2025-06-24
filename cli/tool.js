import fs from "fs/promises";
import utils from "../shared/encryption.js";
import _sodium from "libsodium-wrappers";

let args = process.argv.slice(2);

function checkArgs() {
  if (!args[0] || args[0].slice(-3) !== ".md") {
    throw new Error("Please provide a markdown file");
  }
  if (!args[1]) {
    throw new Error("Please provide a valid api key");
  }
  if (!args[2]) {
    throw new Error("Please provide your assigned encryption key");
  }
}

async function auth() {
  //API key authentication here or whatever
  const hash = (await fs.readFile("../testHash.md", "utf8")).trim();
  await _sodium.ready;
  let sodium = _sodium;

  const encKeybase64 = await fs.readFile("../testkey.md", "utf8");
  //const encKeybase64 = await fs.readFile(args[2], "utf8");
  const encKey = sodium.from_base64(encKeybase64.trim());
  //check fingerprint here
  if (sodium.to_base64(sodium.crypto_generichash(32, encKey)) === hash) {
    return encKey;
  } else {
    throw new Error("Invalid encryption key!");
  }
}

try {
  checkArgs();
  const encKey = await auth();
  let msg = await utils.encrypt(await fs.readFile(args[0], "utf8"), encKey);
  let packet = {
    source: "cli",
    message: msg,
    timestamp: Date.now(),
  };
  //send packet to the server
  console.log("Success!");
} catch (err) {
  console.error("An error occured while processing the entry:\n", err);
  process.exit(1);
}
