import _sodium from "libsodium-wrappers";
async function encrypt(message, key) {
  await _sodium.ready;
  const sodium = _sodium;
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const msgBytes = sodium.from_string(message);
  const ciphertext = sodium.crypto_secretbox_easy(msgBytes, nonce, key);
  return sodium.concat(nonce, ciphertext);
}
async function decrypt(ciphertext, key) {
  await _sodium.ready;
  const sodium = _sodium;
  let nonce = ciphertext.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  ciphertext = ciphertext.slice(sodium.crypto_secretbox_NONCEBYTES);
  try {
    message = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
    if (!message) {
      throw new Error(
        "Decryption failed: ciphertext may have been tampered with or the key is incorrect.",
      );
    }
  } catch (err) {
    return err;
  }
  return sodium.to_string(message);
}
