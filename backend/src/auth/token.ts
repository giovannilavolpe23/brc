import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { AuthUser } from "./types";

export const AUTH_COOKIE_NAME = "access_token";
export const AUTH_TOKEN_TTL_SECONDS = 24 * 60 * 60;

type AuthTokenPayload = {
  sub: string;
};

export function signAuthToken(user: AuthUser): string {
  return jwt.sign({}, env.jwtSecret, {
    subject: user.id,
    expiresIn: AUTH_TOKEN_TTL_SECONDS,
  });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const payload = jwt.verify(token, env.jwtSecret);
  if (typeof payload !== "object" || !payload.sub) {
    throw new Error("Invalid auth token");
  }
  return { sub: payload.sub };
}
