import $ from "jquery";
import _sodium from "libsodium-wrappers";

const animations = {
  async pageLand() {
    $("#whiteScreen").addClass("hidden");
    await wait(800);
    $("#content").removeClass("hidden");
    return 1;
  },
  async pageLeave() {
    $("#background").addClass("hidden");
    await wait(2500);
    const video = $("#leave")[0];
    video.play();
    await wait(2000);
    $("#whiteScreen").removeClass("hidden");
    await wait(2000);
    return 1;
  },
};

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function domReady() {
  return new Promise((resolve) => {
    $(resolve);
  });
}

function concatUint8Arrays(a, b) {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

async function encrypt(message, key) {
  await _sodium.ready;
  const sodium = _sodium;
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const msgBytes = sodium.from_string(message);
  const ciphertext = sodium.crypto_secretbox_easy(msgBytes, nonce, key);
  return sodium.to_base64(concatUint8Arrays(nonce, ciphertext));
}

async function decrypt(ctbase64, key) {
  await _sodium.ready;
  const sodium = _sodium;
  let ciphertext = sodium.from_base64(ctbase64);
  let nonce = ciphertext.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  ciphertext = ciphertext.slice(sodium.crypto_secretbox_NONCEBYTES);
  try {
    let message = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
    if (!message) {
      throw new Error(
        "Decryption failed: ciphertext may have been tampered with or the key is incorrect.",
      );
    }
    return sodium.to_string(message);
  } catch (err) {
    throw err;
  }
}

async function keygen() {
  await _sodium.ready;
  let sodium = _sodium;

  let uintKey = sodium.crypto_secretbox_keygen();
  let key = sodium.to_base64(uintKey);
  let keyHash = sodium.to_base64(sodium.crypto_generichash(32, uintKey));
  return [key, keyHash];
}

async function tth16(text) {
  await _sodium.ready;
  let sodium = _sodium;

  let h = sodium.crypto_generichash(16, text);
  let h64 = sodium.to_base64(h);
  return [h, h64];
}

async function mac(message, key) {
  await _sodium.ready;
  let sodium = _sodium;
  return sodium.crypto_auth(message, key);
}

async function fromB64(text) {
  await _sodium.ready;
  let sodium = _sodium;
  return sodium.from_base64(text);
}

async function toB64(uintArrayy) {
  await _sodium.ready;
  let sodium = _sodium;
  return sodium.to_base64(uintArrayy);
}

export default {
  wait,
  animations,
  domReady,
  keygen,
  encrypt,
  decrypt,
  tth16,
  mac,
  fromB64,
  toB64,
};
