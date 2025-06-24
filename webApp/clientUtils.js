import _sodium from "libsodium-wrappers";

async function keygen() {
  await _sodium.ready;
  let sodium = _sodium;

  let uintKey = sodium.crypto_secretbox_keygen();
  let key = sodium.to_base64(uintKey);
  let keyHash = sodium.to_base64(sodium.crypto_generichash(32, uintKey));
  return { key, keyHash };
}

export default { keygen };
