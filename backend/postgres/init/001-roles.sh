#!/bin/sh
# Sourced by the official image on the first initialization of an empty volume.
# This file only creates roles and basic permissions; tables use migrations.
set -eu
: "${SUNNY_PG_APP_PASSWORD:?Missing app password}"
: "${SUNNY_PG_AUTH_PASSWORD:?Missing auth password}"

psql -X --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_password SUNNY_PG_APP_PASSWORD
\getenv auth_password SUNNY_PG_AUTH_PASSWORD
BEGIN;
CREATE ROLE sunny_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE sunny_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD :'app_password';
CREATE ROLE sunny_auth LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD :'auth_password';
REVOKE ALL ON DATABASE sunny FROM PUBLIC;
GRANT CONNECT ON DATABASE sunny TO sunny_app, sunny_auth;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER ROLE sunny_app IN DATABASE sunny SET search_path = app, pg_catalog;
ALTER ROLE sunny_auth IN DATABASE sunny SET search_path = auth, pg_catalog;
COMMIT;
\unset app_password
\unset auth_password
SQL
