import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { createAdminDevRouter, createPostgresDevResetRepository, type DevResetSummary } from "../src/admin/dev-reset";
import type { AuthUser } from "../src/auth/types";

const admin: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  legacyId: "gio",
  displayName: "Gio",
  role: "admin",
  permissions: [],
};

const user: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  legacyId: "jere",
  displayName: "Jere",
  role: "user",
  permissions: ["create_previa"],
};

const emptySummary: DevResetSummary = {
  moneyMovements: 0,
  dailyEntries: 0,
  surveyVotes: 0,
  previas: 0,
  previaProducts: 0,
  previaParticipants: 0,
  initialBalances: 0,
};

function authAs(authUser: AuthUser): RequestHandler {
  return (req, _res, next) => {
    req.user = authUser;
    next();
  };
}

function makeApp(authUser: AuthUser, resetData: () => Promise<DevResetSummary> = async () => emptySummary) {
  const app = express();
  app.use(express.json());
  app.use(
    "/admin/dev",
    createAdminDevRouter(
      {
        resetData,
      },
      authAs(authUser),
      "reset-password"
    )
  );
  return app;
}

describe("admin development data reset", () => {
  it("rejects regular users", async () => {
    const response = await request(makeApp(user)).delete("/admin/dev/reset-data").send({ password: "reset-password" });

    assert.equal(response.status, 403);
  });

  it("rejects admins with an incorrect reset password", async () => {
    let called = false;
    const response = await request(
      makeApp(admin, async () => {
        called = true;
        return emptySummary;
      })
    )
      .delete("/admin/dev/reset-data")
      .send({ password: "wrong-password" });

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "invalid_reset_password" });
    assert.equal(JSON.stringify(response.body).includes("wrong-password"), false);
    assert.equal(called, false);
  });

  it("allows admins with the correct password and reports deleted rows", async () => {
    const summary: DevResetSummary = {
      moneyMovements: 2,
      dailyEntries: 3,
      surveyVotes: 4,
      previas: 1,
      previaProducts: 5,
      previaParticipants: 6,
      initialBalances: 0,
    };

    const response = await request(makeApp(admin, async () => summary))
      .delete("/admin/dev/reset-data")
      .send({ password: "reset-password" });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.deleted, summary);
    assert.deepEqual(response.body.preserved, [
      "users",
      "roles",
      "permissions",
      "user_permissions",
      "survey_questions",
      "initial_balances",
    ]);
  });

  it("deletes only statistics data tables and commits in a transaction", async () => {
    const queries: string[] = [];
    const client = {
      async query(sql: string) {
        queries.push(sql);
        return { rowCount: 1, rows: [] };
      },
      release() {
        queries.push("release");
      },
    };

    const repository = createPostgresDevResetRepository(async () => client);
    const summary = await repository.resetData();

    assert.deepEqual(queries, [
      "begin",
      "delete from survey_votes",
      "delete from previa_participants",
      "delete from previa_products",
      "delete from previas",
      "delete from daily_entries",
      "delete from money_movements",
      "commit",
      "release",
    ]);
    assert.equal(summary.initialBalances, 0);
    assert.equal(queries.some((query) => /users|roles|permissions|initial_balances|survey_questions/.test(query)), false);
  });

  it("rolls back and releases the connection if the reset fails", async () => {
    const queries: string[] = [];
    const client = {
      async query(sql: string) {
        queries.push(sql);
        if (sql === "delete from daily_entries") throw new Error("boom");
        return { rowCount: 1, rows: [] };
      },
      release() {
        queries.push("release");
      },
    };

    const repository = createPostgresDevResetRepository(async () => client);

    await assert.rejects(() => repository.resetData(), /boom/);
    assert.equal(queries.includes("rollback"), true);
    assert.equal(queries.includes("commit"), false);
    assert.equal(queries.at(-1), "release");
  });
});
