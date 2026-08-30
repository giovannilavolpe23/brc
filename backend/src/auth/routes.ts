import { Router } from "express";
import { verifyPassword } from "./password";
import { createRequireAuth } from "./middleware";
import { signAuthToken } from "./token";
import { toPublicUser, type UserCredentials } from "./types";
import { findUserCredentialsByLegacyId, listActiveAuthUsers } from "./users.repository";

type FindCredentials = (legacyId: string) => Promise<UserCredentials | null>;
type ListUsers = () => Promise<Awaited<ReturnType<typeof listActiveAuthUsers>>>;

export function createAuthRouter(
  findCredentials: FindCredentials = findUserCredentialsByLegacyId,
  listUsers: ListUsers = listActiveAuthUsers
): Router {
  const router = Router();
  const requireAuth = createRequireAuth();

  router.get("/users", async (_req, res, next) => {
    try {
      const users = await listUsers();
      res.json({ users: users.map(toPublicUser) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";

      if (!username || !password) {
        res.status(401).json({ error: "invalid_credentials" });
        return;
      }

      const user = await findCredentials(username);
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        res.status(401).json({ error: "invalid_credentials" });
        return;
      }

      res.json({ user: toPublicUser(user), accessToken: signAuthToken(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", (_req, res) => {
    res.status(204).send();
  });

  router.get("/me", requireAuth, (req, res) => {
    res.json({ user: toPublicUser(req.user) });
  });

  return router;
}

export const authRouter = createAuthRouter();
