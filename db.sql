BEGIN;
CREATE USER webapp;
CREATE SCHEMA journal AUTHORIZATION webapp;
CREATE TABLE journal.cred_auth (
	email_id VARCHAR(255) PRIMARY KEY,
	pwd TEXT NOT NULL
);
CREATE TABLE journal.api_auth (
	api_key TEXT PRIMARY KEY,
	email_id VARCHAR(255) NOT NULL UNIQUE,
	FOREIGN KEY (email_id) REFERENCES journal.cred_auth(email_id)
);
CREATE TABLE journal.enc_authz (
	email_id VARCHAR(255) PRIMARY KEY,
	enc_key TEXT NOT NULL UNIQUE,
	FOREIGN KEY (email_id) REFERENCES journal.cred_auth(email_id)
);
CREATE TABLE journal.entries (
	enc_key TEXT NOT NULL,
	entry_id INT NOT NULL,
	group_name VARCHAR(255) NOT NULL DEFAULT 'default',
	modified_at TIMESTAMP NOT NULL,
	PRIMARY KEY (enc_key, entry_id),
	FOREIGN KEY (enc_key) REFERENCES journal.enc_authz(enc_key)
);
GRANT USAGE, CREATE ON SCHEMA journal TO webapp;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA journal TO webapp;
COMMIT;
