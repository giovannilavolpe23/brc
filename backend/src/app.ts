import type { ErrorRequestHandler } from "express";
import express from "express";
import { checkDatabaseConnection } from "./db/pool";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
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
