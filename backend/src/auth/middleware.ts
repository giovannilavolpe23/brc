import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "./token";
import { findAuthUserById } from "./users.repository";
import type { AuthUser } from "./types";

export type LoadAuthUser = (id: string) => Promise<AuthUser | null>;

export function createRequireAuth(loadAuthUser: LoadAuthUser = findAuthUserById): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token || typeof token !== "string") {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    try {
      const payload = verifyAuthToken(token);
      const user = await loadAuthUser(payload.sub);
      if (!user) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: "unauthorized" });
    }
  };
}

export const requireAuth = createRequireAuth();

export function requireRole(role: string): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    if (req.user.role !== role) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    next();
  };
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  return user.role === "admin" || user.permissions.includes(permission);
}

export function requirePermission(permission: string): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    if (!hasPermission(req.user, permission)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    next();
  };
}
