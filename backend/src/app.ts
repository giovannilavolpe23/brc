import type { ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { requireAuth } from "./auth/middleware";
import { authRouter } from "./auth/routes";
import { toPublicUser } from "./auth/types";
import { env } from "./config/env";
import { dailyEntriesRouter } from "./daily-entries/routes";
import { checkDatabaseConnection } from "./db/pool";
import { moneyRouter } from "./money/routes";
import { surveysRouter } from "./surveys/routes";

export const app = express();

app.use(
  cors({
    origin: env.frontendOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRouter);
app.use("/money", moneyRouter);
app.use("/daily-entries", dailyEntriesRouter);
app.use("/surveys", surveysRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/me", requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

app.get("/health/db", async (_req, res, next) => {
  try {
    await checkDatabaseConnection();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    ok: false,
    error: "internal_server_error",
  });
};

app.use(errorHandler);
