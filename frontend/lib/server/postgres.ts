import "server-only";
import { Pool, type PoolClient } from "pg";

export function createRuntimePool(connectionString: string, role: "sunny_auth" | "sunny_app") {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || decodeURIComponent(url.username) !== role) {
    throw new Error("Invalid runtime database role");
  }
  if (process.env.NODE_ENV === "production" && url.searchParams.get("sslmode") !== "verify-full") {
    throw new Error("Production database requires verified TLS");
  }
  return new Pool({ connectionString, max: 5, connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000, options: `-c search_path=${role === "sunny_auth" ? "auth" : "app"},pg_catalog` });
}

export async function verifyRuntimePool(pool: Pool, role: "sunny_auth" | "sunny_app") {
  const result = await pool.query(`SELECT current_user AS name, rolsuper OR rolbypassrls OR rolcreatedb
    OR rolcreaterole OR pg_has_role(current_user, 'sunny_owner', 'MEMBER')
    OR has_database_privilege(current_user, current_database(), 'CREATE')
    OR has_database_privilege(current_user, current_database(), 'TEMP')
    OR has_schema_privilege(current_user, $2, 'CREATE')
    OR has_schema_privilege(current_user, $1, 'USAGE') AS unsafe
    FROM pg_roles WHERE rolname = current_user`, [role === "sunny_auth" ? "app" : "auth", role === "sunny_auth" ? "auth" : "app"]);
  if (result.rows.length !== 1 || result.rows[0].name !== role || result.rows[0].unsafe) {
    throw new Error("Runtime database privileges rejected");
  }
}

export async function withUserTransaction<T>(pool: Pool, userId: string, run: (client: PoolClient) => Promise<T>) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("Invalid verified user ID");
  }
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const value = await run(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { broken = true; }
    throw error;
  } finally { client.release(broken); }
}
