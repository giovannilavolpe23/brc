import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

describe("environment examples", () => {
  it(".env.example declares DATABASE_URL without a secret", () => {
    const envExample = fs.readFileSync(path.resolve(__dirname, "../.env.example"), "utf8");

    assert.match(envExample, /^DATABASE_URL=$/m);
    assert.match(envExample, /^DEV_RESET_PASSWORD=$/m);
    assert.match(envExample, /^JWT_SECRET=$/m);
    assert.match(envExample, /^FRONTEND_ORIGIN=$/m);
    assert.match(envExample, /^NODE_ENV=$/m);
    assert.match(envExample, /^VAPID_PUBLIC_KEY=$/m);
    assert.match(envExample, /^VAPID_PRIVATE_KEY=$/m);
    assert.match(envExample, /^VAPID_SUBJECT=$/m);
    assert.match(envExample, /^CRON_SECRET=$/m);
    assert.doesNotMatch(envExample, /postgresql:\/\//);
    assert.doesNotMatch(envExample, /YOUR-PASSWORD/i);
    assert.doesNotMatch(envExample, /supabase\.co/i);
    assert.doesNotMatch(envExample, /eyJ/);
  });

  it("backend .gitignore excludes local environment files", () => {
    const gitignore = fs.readFileSync(path.resolve(__dirname, "../.gitignore"), "utf8");

    assert.match(gitignore, /^\.env$/m);
  });
});
