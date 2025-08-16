BEGIN;
CREATE SCHEMA journal AUTHORIZATION ${POSTGRES_USER};
CREATE TABLE journal.cred_auth (
	uid TEXT PRIMARY KEY,
	salt TEXT NOT NULL,
	apikeyh TEXT NOT NULL UNIQUE
);
CREATE TABLE journal.nonces (
	nonce TEXT PRIMARY KEY,
	uid TEXT NOT NULL,
	intent VARCHAR(255) NOT NULL,
	expires_at TIMESTAMP NOT NULL,
	FOREIGN KEY (uid) REFERENCES journal.cred_auth(uid)
);
CREATE TABLE journal.api_auth (
	apikeyh TEXT PRIMARY KEY,
	enckeyh TEXT NOT NULL UNIQUE,
	FOREIGN KEY (apikeyh) REFERENCES journal.cred_auth(apikeyh)
);
CREATE TABLE journal.entries (
	enckeyh TEXT NOT NULL,
	entry_id INT NOT NULL,
	group_name VARCHAR(255) NOT NULL DEFAULT 'default',
	modified_at TIMESTAMP NOT NULL,
	PRIMARY KEY (enckeyh, entry_id),
	FOREIGN KEY (enckeyh) REFERENCES journal.api_auth(enckeyh)
);
CREATE TABLE journal.placeholders (
	index SERIAL PRIMARY KEY,
	placeholderkey TEXT NOT NULL UNIQUE,
	ready BOOLEAN NOT NULL
);
GRANT USAGE, CREATE ON SCHEMA journal TO ${POSTGRES_USER};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA journal TO ${POSTGRES_USER};
COMMIT;
ALTER ROLE ${POSTGRES_USER} SET search_path TO journal;
