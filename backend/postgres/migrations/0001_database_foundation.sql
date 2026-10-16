-- Infrastructure only: business and Better Auth tables require their contract.
CREATE SCHEMA sunny_meta AUTHORIZATION sunny_owner;
CREATE SCHEMA auth AUTHORIZATION sunny_owner;
CREATE SCHEMA app AUTHORIZATION sunny_owner;

REVOKE ALL ON SCHEMA sunny_meta, auth, app FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO sunny_auth;
GRANT USAGE ON SCHEMA app TO sunny_app;

CREATE TABLE sunny_meta.schema_migrations (
    version integer PRIMARY KEY CHECK (version > 0),
    name text NOT NULL UNIQUE CHECK (name ~ '^[0-9]{4}_[a-z][a-z0-9_]*\.sql$'),
    checksum text NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
    applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    applied_by name NOT NULL DEFAULT session_user,
    execution_ms bigint NOT NULL CHECK (execution_ms >= 0)
);
ALTER TABLE sunny_meta.schema_migrations OWNER TO sunny_owner;
REVOKE ALL ON TABLE sunny_meta.schema_migrations FROM PUBLIC, sunny_app, sunny_auth;

-- No blanket runtime DML grant: each future migration grants only reviewed DML
-- after its RLS/adapter access boundary is in place.
ALTER DEFAULT PRIVILEGES FOR ROLE sunny_owner IN SCHEMA sunny_meta, auth, app
    REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE sunny_owner IN SCHEMA sunny_meta, auth, app
    REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE sunny_owner IN SCHEMA sunny_meta, auth, app
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
