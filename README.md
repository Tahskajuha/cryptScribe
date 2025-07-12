# **cryptScribe (WIP)**

**An implementation of a various cryptographic algorithms and an academically normalized DB to create journal web app usable via both an animated and slick frontend and a CLI tool.**

---

## **Key Features**

- **Zero-Plaintext Backend:**
  The backend is a stateless API server that **never recieves or stores plaintext data**. Encryption/decryption is handled solely on the client-side.

- **Flexible Deployment:**
  Tailored towards local-first workflows. The backend can run locally or be deployed with minimal changes over .onion for optional remote sync, without compromising the threat model.

- **Animations (because why not?):**
  Choose to enjoy cool animations with the frontend -- or skip the flair and jump straight into the CLI for a minimal interface.

- **Database Normalization:**
  The backend uses a relational database normalized up to **BCNF (Boyce-Codd Normal Form)** while still making sure that queries are optimized to require at most one join, thus keeping access overhead minimal.

- **Markdown Rendering:**
  Uses **markdown-it** in the frontend to render markdown-style writing as HTML in real-time. Entries do not touch the network in decrypted state.

- **Electron Frontend for Smooth Local UX:**
  The frontend runs on Electron, ensuring a responsive local experience even when connecting over privacy-preserving networks like Tor.

- **Opt-In Password Reset:**
  The app allows the user to choose whether they want the option to reset their password later. For maximum privacy, the user can enter unique gibberish instead of a valid email ID which will effectively disable the password reset feature.

---

## **Current Development Roadmap**

### **Core Infrastructure (completed)**

- [x] Set up project dependencies and structure.
- [x] Challenge endpoint for initiating auth.
- [x] Login/Register/Write response handling.
- [x] Create the main security-model (and refactor it a bunch of times based on threat-models).
- [x] Authentication UI with client-side keygen.
- [x] Relational database setup, normalized to BCNF. Create script for migration and initialization.
- [x] Core encryption/decryption logic.
- [x] Crypto-safe placeholder/nonce/salt generators using libsodium.
- [x] JWT-based token issuance with short lifetimes and minimal payload.
- [x] Utilities library for the frontend.
- [x] Separate signing keys for read and write tokens.

### **TO-DO**

- [ ] Finish CLI auth flow.
- [ ] Implement strict rate-limiting on all routes.
- [ ] Build a minimal markdown editor using react with a sync button and a key-input.
- [ ] Implement endpoints for read (GET via login/read token), write (POST with write token) and password reset.
- [ ] CLI interface for reading/writing securely.
- [ ] Prepare for .onion-compatible backend deployment (for both local and remote use).
- [ ] Set up Vite build for Electron frontend.
- [ ] Set up esbuild for CLI tool bundling.
- [ ] Create a 'Usage' section in the README for both local and remote deployment instructions.
- [ ] Add unified logging layer in the server.
- [ ] UI for key regeneration (with warning + optional export)
- [ ] Server-side endpoint for bulk-deletion of user-owned entries (triggered at key regeneration or manually).
- [ ] Database update on key regen or password reset.

---

## **Security Model**

This app is built around a zero-plaintext, zero-trust model. The backend is stateless, never receives or stores any plaintext user identifiers, passwords or encryption keys.

- **Key Derivation Chain:**<br />
  `APIKEY = Argon2id(password, salt=blake2b(uuid))
APIKEY_HASH = Argon2id(APIKEY, salt=per_user_random_salt_from_server`<br />
  A total of **10 salt rounds** are used across UUID + password -> APIKEY -> APIKEY_HASH, enforcing resilience against brute-force attacks.

- **Zero-Knowledge UID Verification:**
  UUID is never sent as plaintext. Instead, the client sends blake2b(UUID). The server compares it against the hash it has -- no secrets exposed.

- **Challenge-Response Nonce Protocol:**
  If the UUID hash is valid, the server returns a fresh, time-bound, intent-specific nonce and a 32 B salt generated using crypto-safe random generator and assigned to that UUID on registration.<br />
  Additionally, a nonce cleaner prunes stale nonces while redundant checks at response endpoints make absolutely certain that no expired nonce gets through.

- **Login via HMAC:**
  The client proves knowledge of APIKEYH via:<br />
  `HMAC = MAC(APIKEYH, nonce)`

- **Registration Flow (Key Separation):**
  On registration, a strong non-derivable encryption key (ENCKEY) is generated client-side and never sent over the network. Only ENCKEYH is sent alongside APIKEYH where:<br />
  `ENCKEYH = blake2b(ENCKEY)`<br />
  The encryption key never touches the backend -- ever.

- **Encrypted Data Association:**
  All user entries are encrypted with the client-held ENCKEY. Data is stored server-side only under ENCKEYH and read/write actions require a valid JWT containing it.<br />
  ENCKEYH alone is useless to the server or any attacker without ENCKEY.

- **Strict DB Acess Model:**
  The database is localhost only with no ports exposed externally. SSH access is the only way to reach it.

- **Tor Deployment:**
  The backend runs as a stateless API over .onion to maximize end-to-end privacy, limit metadata leakage and stay fast(hopefully) with the help of the good-ol' "less is more" strategy.

---

## **Threat Assumptions**

- The user and the server are hopefully living in the same reality.

- The user understands that if their device is compromised, the entire security model is void and the author will laugh at them.

- The user doesn't try to be the type of genius who believes in obscurity over proper key-handling.
