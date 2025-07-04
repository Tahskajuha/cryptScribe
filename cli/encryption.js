import _sodium from "libsodium-wrappers";

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

export default { encrypt, decrypt };
