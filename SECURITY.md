# cryptScribe Security Model

> The security model for this app follows a strict zero-trust assumption: the server should never be trusted with plaintext data or reusable secrets. Rather, its role is limited to authorizing access instead of performing authentication.

---

## Threat Model

This section defines the threats cryptScribe is designed to mitigate and those explicitly considered out of scope, providing clarity on the security guarentees and limits of the system.

### In-Scope Threats

- **Server Compromise/Data at Rest:** The server can be prone to break-ins or read by a malicious admin. This threat is mitigated by storing ciphertext only; thus ensuring that the server itself (and thus anyone with any form of access to it) doesn't have access to any data belonging to the user.

- **Replay Attacks:** A valid login response can be recorded and reused later to impersonate the user. This attack vector is hence aptly named a _Replay Attack_ and is mitigated by tying every sensitive response to a one-time nonce which expires as soon as it is used.

- **Interception of Data in Motion:** Network traffic can be intercepted, exposing or tampering communication between the client and the server. To mitigate this issue, the app makes sure that no data leaves the client without being encrypted first. Moreover, all the traffic is routed over Tor to provide another layer of defense.

- **Predatory Misuse of Issued Tokens:** Stolen access tokens could be reused to call protected endpoints. Therefore, it is made sure that tokens are deliberately short-lived, scoped to minimal identifiers, atomic in the permissions they grant and wiped out on server restart, limiting the potential impact.

### Out-of-Scope Threats

- **Compromised Client Device:** Malware or attackers on the client device are considered beyond the scope of this app.

- **User Mishandling Keys:** Loss or exposure of secret keys required to access and modify data will cause in loss of the data tied to the key by design. There is no backdoor.

- **Traffic Analysis on Tor:** Network-level metadata leakage is outside the scope of the application.

- **Denial of Service (DoS/DDoS):** Attacks that flood the server with traffic to make it slow or unavailable. Rate-limiting and other protections are not yet implemented but will be added as soon as possible.

---

## Authorization Model

As mentioned earlier, cryptScribe does not implement traditional authentication. Instead, it authorizes users to perform specific actions tied to their credentials and their tokens. This section outlines the types of tokens that the server can issue and the flows used to generate them.

### Registration

This flow cover how credentials and keys are generated and how the user's storage file ("userfile") is initialized:

- The process is initiated by entering a unique username and password alongside an intent which specifies what the user wants to do (in this case, register) into the client.

- Client first sends only the UUID along with the intent to the server which then checks if the UUID already exists. The UUID is generated as follows:

```
UUID = libsodium.crypto_generichash(username, output=16)
```

- Once the server confirms that the UUID does not already exist, a one-time nonce and a per-user salt is issued:

```
nonce = libsodium.randombytes_buf(output=32)
salt = libsodium.randombytes_buf(output=32)
```

This nonce along with its time of issuance, expiration time (time of issuance + 30 seconds), intent and UUID is entered into a nonce-table handled by Postgres. Both the nonce and the salt are then sent to the client.

- During the time the client takes to generate the response, the UUID and per-user salt are stored as a dummy entry on the server so that the client does not have to send all the credentials in the response.

- During this time, as the server is preparing to send the salt and nonce, the client generates the secretkey:

```
secretkey = Argon2id(
    pass=password,
    salt=UUID,
    time=5,
    mem=65536,
    parallelism=1,
    hashLen=24
)
```

- When the client receives the salt and nonce, it generates an enckey and its corresponding enckey_hash:

```
enckey = libsodium.crypto_secretbox_keygen()
enckey_hash = libsodium.crypto_generichash(enckey, output=32)
```

enckey is provided to the user and never leaves the user's device.

- Client now generates the response package and sends it to the server:

```
secretkey_hash = Argon2id(
    pass=secretkey,
    <!-- Salt sent by the server is used here -->
    salt=salt,
    time=5,
    mem=65536,
    parallelism=1,
    hashLen=32
)

response_package = {
    secretkey_hash,
    enckey_hash,
    <!-- Nonce sent by the server is sent back as is -->
    nonce
}
```

- The server receives the response package and checks the nonce's existence, expiration date and intent for discrepencies in case of which the response package is rejected, the nonce is deleted from the nonce-table along with the dummy entry.

- Once the nonce is verified, the server replaces the dummy entry with the actual secretkey_hash and makes another entry in a separate table which maps the secretkey_hash to the enckey_hash. The nonce is now deleted and an empty userfile is generated along with a READ token (token generation is explained further in the next section).

  > The userfile is just a file named after the user's enckey_hash which contains the user's encrypted journal entry in JSON format allowing for easy mapping and access.

#### Design Rationale

- The original prototype aimed for a "one key to log in, one key to decrypt" model. As the name suggests, this model would have used just a single key to log in since this would align with the statelesness of the backend. As such, this "secretkey" was decided to be generated from the user's credentials for convenience.

  While the server still remains stateless, the later introduced challenge-response authentication results in the requirement of a UUID that is used to issue the challenge whose response contains the actual secret. As a result, the first derivation stage is now partly a remnant of the earlier prototype design that is retained because major refactors need to be deferred at the current stage to ensure practicality as this is project is developed by a solo student.

  To reconcile the two approaches, the CLI will unify these components into a single credential required from the user:

  ```
  UNIFIED_APIKEY = secretkey || UUID
  ```

  This credential will act as the secret handled by Electron's main process solely on the client-side to ensure that the established challenge-response system is followed while maintaining convenience.

- While expiration of every nonce is checked extrinsically as soon as the response package is recieved, a cleaner function is also employed to remove expired nonces from the nonce-table to ensure cleanliness and faster search times.

- Currently, the dummy entry requires the use of a placeholder since the real secret hash (a required field in the current schema) is only available after nonce validation. As such 20 placeholders are generated at server start where:

  ```
  placeholder = libsodium.randombytes_buf(output=32)
  ```

  One of these is picked at random to be used in the dummy entry. These placeholders are treated as extremely sensitive server-side secrets that never leave the server and can be easily regenerated with a simple server restart in case of emergency.

### Token Issuance

The flow for issuing a token remains the same with the only difference being in the intent sent to the server along with the request. This section will first explain the general flow and then the tokens that can be issued by the user. Note that several terms used here are explained in the **Registration** section.

- The client sends the UUID along with one of three intents (excluding registration) to the server. At the same time, the client generates the secretkey.

- The server verifies that the UUID exists and then generates a one-time nonce which is stored in the nonce-table along with its time of issuance, expiration time (time of issuance + 30 seconds), intent and UUID.

- The server then sends the salt tied to the UUID along with the nonce to the client as the challenge.

- The client generates the secretkey_hash and then an HMAC to prove ownership of secretkey as the response:

  ```
  HMAC = libsodium.crypto_auth(secretkey_hash, nonce)

  response_package = {
    HMAC,
    nonce
  }
  ```

- Once the server has verified the nonce's validation after receiving the response, it verifies the HMAC with the secretkey_hash using libsodium's **crypto_auth_verify** function.

- After verification, the server issues a JWT based on the intent. As mentioned earlier, all user data is contained in one JSON file which is mapped to the user's enckey_hash. As such, no matter the intent the content of the JWT is always only the enckey_hash. The intent of the token is determined by the key it is signed with where each of the three keys are generated at server start:

  ```
  READKEY/WRITEKEY/RESETKEY = libsodium.randombytes_buf(output=32)
  ```

#### Read Token (Signed by READKEY) [Life: 10 minutes]

Allows the user to access the endpoint which reads the userfile and returns its content as-is to the client.

#### Write Token (Signed by WRITEKEY) [Life: 10 minutes]

Allows the user to access the endpoint which overwrites the userfile with the JSON object sent by the client alongside the token.

#### Password Reset Token (Signed by PWDRESET) [Life: 5 minutes]

Allows the user to reset their password (explored further in the last section).

#### Encryption Key Reset Token (Signed by RESETKEY) [Life: 2 minutes]

Allows the user to access the encryption key reset endpoint (explored further in the next section).

---

## Encryption Model

Encryption in cryptScribe is treated as the last line of defense; coming into play in extreme failures such as server compromise, database dump, traffic interception or targeted attacks. As such, strong encryption is applied solely on the client-side before the journal content ever reaches the server. This limits the server's role to storing only ciphertext and issuing tokens for access but it never has access to encryption keys or plaintext data.

- The enckey is generated during registration using libsodium's keygen function [as mentioned earlier in the registration section] and provided to the user at the same time. The server never sees it.

- The entire journal is ideally in the form of a JSON object whose first name/value pair is always blake2b(enckey) for the user to verify their key with. The rest of the object is in the format:

  ```
  entryName/entryNumber: entry
  ```

  Where each of these entries is encrypted separately as follows:

  ```
  nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  ciphertext = sodium.crypto_secretbox_easy(entry, nonce, enckey)
  encryptedEntry = concat(nonce, ciphertext)
  ```

- This new object with every entry encrypted is then sent to the server whenever a Write Token is used. The server stores this object as-is in the userfile. Later, when the user gets the contents of the file via a Read Token, the client decrypts each entry:

  ```
  [nonce, ciphertext] = [encryptedEntry.slice(0, sodium.crypto_secretbox_NONCEBYTES), encryptedEntry.slice(sodium.crypto_secretbox_NONCEBYTES)]
  entry = sodium.crypto_secretbox_open_easy(ciphertext, nonce, enckey)
  ```

### ENCKEY Reset Flow

If the enckey is lost, data encrypted by it cannot be recovered. There is no backdoor. However, the app allows a full wipe that deletes existing data from the server after providing a final download of the userfile as-is and generates a new enckey. This is done via the Encryption Key Reset Token mentioned earlier. The flow is similar to that at the end of registration where a new enckey and userfile is generated.

---

## (Optional) Password Reset Flow

Password reset is an important convenience feature which ensures that a forgotten password doesn't lead to permanent account loss. While there is nothing that can be done on enckey loss, the user is provided with the choice of whether they want the convenience of password reset (thus making them responsible for only one secret instead of two) at the cost of a small part of security provided as this flow does not strictly follow the design philosophy like other flows in this app:

- The choice for enabling password reset is engrained into the registration itself in the username field: this field does not check for a valid email ID but rather only for if the entered value is unique. If the user's email ID is entered in the field, it can later be used to mail the reset token to user. On the other hand, registering using any gibberish automatically means that the password reset feature will not be available for said account since the server doesn't have an email ID to send the mail to.

- This fact is communicated precisely to the user during registration so that there is no confusion.

- During password reset, the user first sends their email ID to the request reset endpoint, making this the one and only time plaintext is ever sent over the network to the server.

- The server verifies the email ID received and uses blake2b(emailID) to verify that the UUID exists (since emailID is the UUID in this case). Once verified, the server mails the Password Reset Token to the address.

- The client provides this token along with the new secretkey_hash to the server which then updates its database. The new password can now be used to generate any token.
