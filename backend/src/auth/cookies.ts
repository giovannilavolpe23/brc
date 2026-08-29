import type { CookieOptions, Response } from "express";
import { env } from "../config/env";
import { AUTH_COOKIE_NAME, AUTH_TOKEN_TTL_SECONDS } from "./token";

export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    maxAge: AUTH_TOKEN_TTL_SECONDS * 1000,
    path: "/",
  };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    ...authCookieOptions(),
    maxAge: undefined,
  });
}
