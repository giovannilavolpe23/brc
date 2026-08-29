import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

type NodeEnv = "development" | "test" | "production";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readNodeEnv(): NodeEnv {
  const value = requireEnv("NODE_ENV");
  if (value !== "development" && value !== "test" && value !== "production") {
    throw new Error("NODE_ENV must be one of: development, test, production");
  }
  return value;
}

export const env = {
  databaseUrl: requireEnv("DATABASE_URL"),
  frontendOrigin: requireEnv("FRONTEND_ORIGIN"),
  jwtSecret: requireEnv("JWT_SECRET"),
  nodeEnv: readNodeEnv(),
  port: Number(process.env.PORT || 3000),
};
