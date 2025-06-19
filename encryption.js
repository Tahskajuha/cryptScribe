import _sodium from "libsodium-wrappers";
async function encrypt() {
  await _sodium.ready;
  const sodium = _sodium;
}
