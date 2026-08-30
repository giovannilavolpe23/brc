import { pool } from "../db/pool";
import type { AuthUser, UserCredentials } from "./types";

type UserRow = {
  id: string;
  legacy_id: string;
  display_name: string;
  password_hash?: string;
  role_key: string;
  permissions: string[] | null;
};

function mapAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    displayName: row.display_name,
    role: row.role_key,
    permissions: row.permissions || [],
  };
}

export async function findUserCredentialsByLegacyId(legacyId: string): Promise<UserCredentials | null> {
  const result = await pool.query<UserRow>(
    `
      select
        users.id,
        users.legacy_id,
        users.display_name,
        users.password_hash,
        roles.key as role_key,
        coalesce(array_agg(permissions.key) filter (where permissions.key is not null), '{}') as permissions
      from users
      join roles on roles.id = users.role_id
      left join user_permissions on user_permissions.user_id = users.id
      left join permissions on permissions.id = user_permissions.permission_id
      where users.legacy_id = $1 and users.is_active = true
      group by users.id, roles.key
      limit 1
    `,
    [legacyId]
  );

  const row = result.rows[0];
  if (!row || !row.password_hash) return null;

  return {
    ...mapAuthUser(row),
    passwordHash: row.password_hash,
  };
}

export async function findAuthUserById(id: string): Promise<AuthUser | null> {
  const result = await pool.query<UserRow>(
    `
      select
        users.id,
        users.legacy_id,
        users.display_name,
        roles.key as role_key,
        coalesce(array_agg(permissions.key) filter (where permissions.key is not null), '{}') as permissions
      from users
      join roles on roles.id = users.role_id
      left join user_permissions on user_permissions.user_id = users.id
      left join permissions on permissions.id = user_permissions.permission_id
      where users.id = $1 and users.is_active = true
      group by users.id, roles.key
      limit 1
    `,
    [id]
  );

  const row = result.rows[0];
  return row ? mapAuthUser(row) : null;
}

export async function listActiveAuthUsers(): Promise<AuthUser[]> {
  const result = await pool.query<UserRow>(
    `
      select
        users.id,
        users.legacy_id,
        users.display_name,
        roles.key as role_key,
        coalesce(array_agg(permissions.key) filter (where permissions.key is not null), '{}') as permissions
      from users
      join roles on roles.id = users.role_id
      left join user_permissions on user_permissions.user_id = users.id
      left join permissions on permissions.id = user_permissions.permission_id
      where users.is_active = true
      group by users.id, roles.key
      order by users.created_at asc, users.display_name asc
    `
  );

  return result.rows.map(mapAuthUser);
}
