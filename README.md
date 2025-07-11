# **cryptScribe (WIP)**

**My implementation of a various cryptographic algorithms and an academically normalized DB to create journal web app usable via both an animated and slick frontend and a CLI tool.**

---

## **Key Features**

    - **Zero-Plaintext Backend**
        The backend is a stateless API server that NEVER recieves or stores plaintext data. Encryption/decryption is handled solely on the client-side.

    - **Flexible Deployment**
        While currently being designed for local-first deployment, the goal is to make sure that only minimal changes are required to deploy the backend over .onion.

    - **Animations (because why not?)**
        Choose to enjoy cool animations with the frontend or cut straight to the meat with the CLI.

    - **Database Normalization**
        The backend uses a relational database normalized up to BCNF (Boyce-Codd Normal Form) while still making sure that queries are optimized to require at most one join, thus keeping access overhead minimal.

---

> README in progress -- more details, to-do list, security model, usage, etc. coming soon.
