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

function domReady() {
  return new Promise((resolve) => {
    $(resolve);
  });
}

async function sodiumReady() {
  await _sodium.ready;
}

function concatUint8Arrays(a, b) {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

function encrypt(message, key) {
  const sodium = _sodium;
  const uintKey = sodium.from_base64(key);
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const msgBytes = sodium.from_string(message);
  const ciphertext = sodium.crypto_secretbox_easy(msgBytes, nonce, uintKey);
  return sodium.to_base64(concatUint8Arrays(nonce, ciphertext));
}

function decrypt(ctbase64, key) {
  let sodium = _sodium;
  try {
    let ciphertext = sodium.from_base64(ctbase64);
    const uintKey = sodium.from_base64(key);
    const nonce = ciphertext.slice(0, sodium.crypto_secretbox_NONCEBYTES);
    ciphertext = ciphertext.slice(sodium.crypto_secretbox_NONCEBYTES);
    let message = sodium.crypto_secretbox_open_easy(ciphertext, nonce, uintKey);
    if (!message) {
      throw new Error(
        "Decryption failed: ciphertext may have been tampered with or the key is incorrect.",
      );
    }
    return sodium.to_string(message);
  } catch (err) {
    console.log(err);
  }
}

function keygen() {
  let sodium = _sodium;

  let uintKey = sodium.crypto_secretbox_keygen();
  let key = sodium.to_base64(uintKey);
  let keyHash = sodium.to_base64(sodium.crypto_generichash(32, uintKey));
  return [key, keyHash];
}

function tth16(text) {
  let sodium = _sodium;

  let h = sodium.crypto_generichash(16, text);
  let h64 = sodium.to_base64(h);
  return [h, h64];
}

function mac(message, key) {
  let sodium = _sodium;
  return sodium.crypto_auth(message, key);
}

function fromB64(text) {
  let sodium = _sodium;
  return sodium.from_base64(text);
}

function toB64(uintArrayy) {
  let sodium = _sodium;
  return sodium.to_base64(uintArrayy);
}

function b2bMatch(key, hash) {
  let sodium = _sodium;
  const uintKey = sodium.from_base64(key);
  const keyHash = sodium.to_base64(sodium.crypto_generichash(32, uintKey));
  return keyHash === hash;
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
  b2bMatch,
};
