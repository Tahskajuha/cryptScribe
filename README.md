# **cryptScribe (WIP)**

> **A zero-plaintext, privacy-first journaling platform that keeps full control of your data in your hands using client-side cryptography, a rigorously normalized backend and a flexible local-first deployment while being fully extensible and customizable.**

---

## **Key Features**

- **<u>Zero-Plaintext Backend</u>:**
  The backend is a stateless API server that **never recieves or stores plaintext data**. Encryption/decryption is handled solely on the client-side.

- **<u>Flexible Deployment</u>:**
  Tailored towards local-first workflows. The backend can run locally or be deployed with minimal changes over .onion for optional remote sync, without compromising the threat model.

- **<u>Electron Frontend for Smooth Local UX</u>:**
  The frontend runs on Electron, ensuring a responsive local experience even when connecting over privacy-preserving networks like Tor.

- **<u>Skins</u>:**
  The renderer layer of the electron app is designed to be plug-and-play. This allows you to build your own frontend on top of the IPC based API. Or, you can choose to skip the GUI entirely as the same API is exposed over localhost; allowing it to be accessible via your preferred CLI.

- **<u>Database Normalization</u>:**
  The backend uses a relational database normalized up to **BCNF (Boyce-Codd Normal Form)** while still making sure that queries are optimized to require at most one join, thus keeping access overhead minimal.

- **<u>Extended Markdown with Real-Time Inline Rendering</u>:**
  The default skin comes with a rich WYSIWYG editor built on TipTap that showcases a markdown-style, easy to remember syntax. No toolbar necessary! On top of that, a Markdown-It based tool is also included to easily import markdown files into the app.

- **<u>Opt-In Password Reset</u>:**
  The app allows the user to choose whether they want the option to reset their password later. For maximum privacy, the user can enter unique gibberish instead of a valid email ID which will effectively disable the password reset feature.

---

## **Current Development Roadmap**

- [x] Set up project dependencies and structure.
- [x] Challenge endpoint for initiating auth.
- [x] Login/Register/Write/KeyReset response handling.
- [x] Backbone security-model.
- [x] Authentication UI with client-side keygen.
- [x] Relational database setup, normalized to BCNF. Create script for migration and initialization.
- [x] Core encryption/decryption logic.
- [x] Crypto-safe placeholder/nonce/salt generators using libsodium.
- [x] JWT-based token issuance with short lifetimes and minimal payload.
- [x] Set up a utilities library for the electron's main process.
- [x] Rich WYSIWYG editor with sync UI.
- [x] Endpoints for read (GET via login/read token), write (POST with write token).
- [x] Prepare for .onion-compatible backend deployment (for both local and remote use).
- [x] Reset password and reset encryption key endpoints.
- [ ] Proper electron sandboxing with extreme prejudice to introduce a plug-and-play renderer system.
- [ ] IPC layer (exposed to localhost) to access functions exposed by the main layer.
- [ ] UI for key regeneration (with warning + optional export).
- [ ] Set up Vite build for Electron renderer.
- [ ] Set up esbuild for CLI additional tools bundling.
- [ ] Strict rate-limiting on all routes.
- [ ] Add unified logging layer in the server.

> **Note:** Development progresses sequentially; I am always working on the next unchecked task in this list.

---

## **Editor Syntax**

cryptScribe's default skin provides a Markdown-inspired, rich text editor built on TipTap. While the input rules feel like Markdown, all formatting is ultimately converted into HTML nodes and marks, which are what TipTap uses internally for rendering and storage.

- The editor behavior is **renderer-specific**: the default skin ships with [editorAddons.js](frontend/src/editorAddons.js), which implements all input rules and formatting behaviors.
- Developers creating custom skins can reuse this file as-is, extend-it or implement something else from scratch, as long as their custom rules produce HTML nodes and marks compatible with TipTap.
- This ensures that no matter the skin, data remains consistent and fully readable across the app.

### **Text Formatting**

| **Feature** | **Input/Shortcut** |
| --- | --- |
| Bold | \*\*text\*\* |
| Italic | \*text\* |
| Strike | \~\~text\~\~ |
| Code | \`text\` |
| Underline | >>text<< |
| Subscript | _\{text\} |
| Superscript | \^text\^ |
| Highlight | \=\=text\=\= |
| Unset All Marks | Ctrl (or Cmd) + Shift + H |

### **Headings & Paragraphs**

| **Feature** | **Input** |
| --- | --- |
| Heading 1-6 | \# Heading 1, \#\# Heading 2, \#\#\# Heading 3 |
| Paragraph | Enter |
| Center | \=\> text |
| Left-Align | \-\> text |
| Right-Align | \<\- text |

### **Lists**

| **Feature** | **Input** |
| --- | --- |
| Bullet List | \- item |
| Ordered List | 1\. item |
| Task List Item (Unchecked) | \[ \] item |
| Task List Item (Checked) | \[x\] item |

### **Blocks**

| **Feature** | **Input** |
| --- | --- |
| Blockquote | \> text |
| Horizontal Rule | \-\-\- |
| Hard Break | Shift + Enter |
| Math (inline) | \$\$ text \$\$ |
| Math (block) | \$\$\$ text \$\$\$ |
| Escape Character | \\char (forces literal rendering of a one character long "char") |

### **Behavior**

- **Highlight Cycling:** Clicking on highlighted text cycles through the colors: Red -> Green -> Blue -> RGB
- **Auto-Unset Marks:** Pressing *Backspace* on an empty block automatically removes active marks.
- **A Known-Issue:** Currently, the text alignment input does not get automatically deleted. This is a known behavior due to how paragraphs work in TipTap and is currently a low-priority bug. Until then, the arrows (->, => and <-) will have to be deleted manually after the respective node is created.

### **Notes**

- All formatting is client-side only, preserving zero-plaintext privacy.
- Input rules aim for a familiar Markdown-like workflow while supporting advanced formatting like subscript, superscript and inline hightlights.
- Custom extensions like *EscapeChar* allow literal insertion of characters that would normally trigger formatting.

---

## **Server Deployment**

Deploying the cryptScribe backend is straightforward and relies on Docker:

### **Prerequisites**

- Install [Docker](https://www.docker.com/products/docker-desktop/).
- Clone this repository.

### **Configuration**

- Copy the file .env.example file in the repository to create the .env file.
- Fill in the required values in .env (You will have to create an account on [Resend](https://resend.com/) if you want the password reset functionality).

### **Start the Backend**

In the directory, run:
```
docker-compose up --build
```

### **Retrieve the .onion URL**

After startup, run:
```
docker exec -it tor cat /var/lib/tor/.tor/hostname
```
This will return a URL, take a note of this URL as the electron app will ask for it at startup.

---

## **Security Model**

This app is built around a zero-plaintext, zero-trust model. The backend is stateless and never receives or stores any plaintext user identifiers, passwords or encryption keys.

- **Key Derivation Chain:**  
Login credentials are transformed into a derived key through a two-stage process. The first stage produces an APIKEY, which is then hardened into an APIKEY_HASH using a per-user random salt provided by the server. Only APIKEY_HASH is ever used for authentication.

- **Challenge-Response Authentication:**  
On account creation, the server stores a hashed lookup tag of the user's UUID. This is used only to confirm the account exists before issuing a challenge. This issued challenge contains the salt and a one-time nonce strictly tracked by the server. The client responds with an HMAC built from APIKEY_HASH and the nonce, proving possession of the secret without sending it over the network. This prevents replay attacks and keeps sensitive data client-side.

- **Key Separation:**
On registration, a strong non-derivable encryption key (ENCKEY) is generated client-side and never leaves the device. This means that if the key is lost, data encrypted by this key is completely unrecoverable. This is a deliberate design decision, made explicit to the user during setup.

  ***Reset Path:** While the server can't help with recovering data lost due to key loss, users can reset their ENCKEY, which wipes all server-side data and starts fresh. They may optionally export the encrypted data before reset if they hope to recover it later with the lost key.*

- **Server-Side Verification and Data Association:**  
Once verified, the server issues a heavily scoped and short-lived JWT that carries only a minimal identifier for data association with no cryptographically useful material. This token enables secure and fast access without exposing useful secrets.

- **Built-in Panic Button:**  
Many server-side secrets are generated at startup. This means most compromises can be dealt with easily using just a server reset, invalidating all existing tokens.

- **Rate Limiting:**  
Rate-limiting is not yet implemented but is acknowledged as a necessary defense and will be added as soon as possible.

- **Crypto-safe Random Number Generator:**  
The app uses libsodium's **randombytes_buf** everywhere a random key/salt/secret/nonce generation is required with enough length to ensure that predictability is diminished as much as possible.

- **Strict DB Access Model:**  
  The database is localhost only with no ports exposed externally; thus making it reachable exclusively via authenticated calls over SSH.

- **Tor Deployment:**  
  The backend runs as a stateless API over .onion to maximize end-to-end privacy, limit metadata leakage and stay fast (hopefully). It is deployed via docker compose to ensure consistency no matter the system it is run on.

For a full breakdown of cryptographic parameters, protocol flows and design notes, see [SECURITY.md](SECURITY.md)

---

## **Threat Assumptions**

- The user understands that if their device is compromised, the entire security model is void.
- The user understands proper key-handling.
