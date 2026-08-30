import { Router, type RequestHandler } from "express";
import { hashPassword } from "../auth/password";
import { requireAuth, requireRole } from "../auth/middleware";
import { toPublicUser, type AuthUser } from "../auth/types";
import { pool } from "../db/pool";

type CreatedUserRow = {
  id: string;
  legacy_id: string;
  display_name: string;
  role_key: string;
  permissions: string[] | null;
};

export type CreateUserInput = {
  displayName: string;
  password: string;
};

export type AdminUsersRepository = {
  createUser(input: CreateUserInput): Promise<AuthUser>;
};

export const postgresAdminUsersRepository: AdminUsersRepository = {
  async createUser(input) {
    const client = await pool.connect();
    try {
      await client.query("begin");

      const duplicateName = await client.query<{ id: string }>(
        "select id from users where lower(display_name) = lower($1) limit 1",
        [input.displayName]
      );
      if (duplicateName.rows[0]) throw new AdminUserValidationError("user_already_exists");

      const role = await client.query<{ id: string }>("select id from roles where key = 'user' limit 1");
      if (!role.rows[0]) throw new Error("default_user_role_not_found");

      const legacyId = await nextLegacyId(client, slugifyLegacyId(input.displayName));
      const passwordHash = await hashPassword(input.password);
      const created = await client.query<CreatedUserRow>(
        `
          insert into users (legacy_id, display_name, password_hash, role_id, is_active)
          values ($1, $2, $3, $4, true)
          returning id, legacy_id, display_name, (select key from roles where roles.id = users.role_id) as role_key
        `,
        [legacyId, input.displayName, passwordHash, role.rows[0].id]
      );

      await client.query("commit");
      return mapCreatedUser(created.rows[0]);
    } catch (error) {
      await client.query("rollback");
      if (isUniqueViolation(error)) {
        throw new AdminUserValidationError("user_already_exists");
      }
      throw error;
    } finally {
      client.release();
    }
  },
};

export function createAdminUsersRouter(
  repository: AdminUsersRepository = postgresAdminUsersRepository,
  authMiddleware: RequestHandler = requireAuth
): Router {
  const router = Router();

  router.post("/users", authMiddleware, requireRole("admin"), async (req, res, next) => {
    try {
      const input = parseCreateUserInput(req.body);
      const user = await repository.createUser(input);
      res.status(201).json({ user: toPublicUser(user) });
    } catch (error) {
      if (error instanceof AdminUserValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}

export const adminUsersRouter = createAdminUsersRouter();

export class AdminUserValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminUserValidationError";
  }
}

function parseCreateUserInput(body: unknown): CreateUserInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AdminUserValidationError("invalid_body");
  }

  const displayName = (body as { name?: unknown; displayName?: unknown }).displayName ?? (body as { name?: unknown }).name;
  const password = (body as { password?: unknown }).password;
  if (typeof displayName !== "string" || displayName.trim() === "") {
    throw new AdminUserValidationError("invalid_name");
  }
  if (typeof password !== "string" || password.trim() === "") {
    throw new AdminUserValidationError("invalid_password");
  }

  return {
    displayName: displayName.trim().replace(/\s+/g, " "),
    password,
  };
}

function slugifyLegacyId(displayName: string): string {
  const slug = displayName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "jugador";
}

async function nextLegacyId(client: Pick<import("pg").PoolClient, "query">, base: string): Promise<string> {
  const existing = await client.query<{ legacy_id: string }>("select legacy_id from users where legacy_id = $1 or legacy_id like $2", [
    base,
    `${base}-%`,
  ]);
  const used = new Set(existing.rows.map((row) => row.legacy_id));
  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function mapCreatedUser(row: CreatedUserRow): AuthUser {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    displayName: row.display_name,
    role: row.role_key,
    permissions: row.permissions || [],
  };
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "23505";
}
