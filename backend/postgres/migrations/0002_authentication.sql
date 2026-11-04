-- #90: Better Auth 1.7.10 + anonymous plugin, advanced.database.generateId=uuid.
-- Generated with better-auth/db/migration, then restricted to auth schema/runtime DML.
-- session/account CASCADE only removes authentication children, never business owners.
SET LOCAL ROLE sunny_owner;
SET LOCAL search_path = auth, pg_catalog;

create table "user" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null, "isAnonymous" boolean);

create table "session" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" uuid not null references "user" ("id") on delete cascade);

create table "account" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "accountId" text not null, "providerId" text not null, "userId" uuid not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table "verification" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create index "session_userId_idx" on "session" ("userId");

create index "account_userId_idx" on "account" ("userId");

create index "verification_identifier_idx" on "verification" ("identifier");
-- Prevent duplicate identities under concurrent requests.
CREATE UNIQUE INDEX account_provider_identity_unique ON auth.account ("providerId", "accountId");

-- Auth validates sessions before there is any app.user_id. It has its own server-only
-- role policy; app users cannot read auth tokens or password hashes.
DO $$
DECLARE table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['user', 'session', 'account', 'verification'] LOOP
        EXECUTE format('ALTER TABLE auth.%I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('ALTER TABLE auth.%I FORCE ROW LEVEL SECURITY', table_name);
        EXECUTE format('REVOKE ALL ON TABLE auth.%I FROM PUBLIC, sunny_app, sunny_auth', table_name);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth.%I TO sunny_auth', table_name);
        EXECUTE format('CREATE POLICY auth_service ON auth.%I FOR ALL TO sunny_auth USING (true) WITH CHECK (true)', table_name);
    END LOOP;
END $$;
