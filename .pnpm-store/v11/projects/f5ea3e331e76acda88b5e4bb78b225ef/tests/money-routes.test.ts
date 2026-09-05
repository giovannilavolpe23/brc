import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { createMoneyRouter } from "../src/money/routes";
import type { MoneyMovement } from "../src/money/types";
import type { MoneyRepository } from "../src/money/repository";
import type { AuthUser } from "../src/auth/types";

const gio: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  legacyId: "gio",
  displayName: "Gio",
  role: "admin",
  permissions: [],
};

const jere: AuthUser = {
  id: "22222222-2222-4222-8222-222222222222",
  legacyId: "jere",
  displayName: "Jere",
  role: "user",
  permissions: ["create_previa"],
};

function makeMovement(overrides: Partial<MoneyMovement> = {}): MoneyMovement {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    userId: jere.id,
    type: "expense",
    amount: 1000,
    category: "Comida",
    description: null,
    movementDate: "2026-08-29",
    createdAt: "2026-08-29T12:00:00.000Z",
    updatedAt: "2026-08-29T12:00:00.000Z",
    ...overrides,
  };
}

function authAs(user: AuthUser): RequestHandler {
  return (req, _res, next) => {
    req.user = user;
    next();
  };
}

function makeRepository(existingMovements: MoneyMovement[] = []): MoneyRepository & { calls: string[] } {
  const movements = [...existingMovements];
  const initialBalances = new Map<string, number>();
  const calls: string[] = [];

  return {
    calls,
    async getUserMoney(userId) {
      calls.push(`get:${userId}`);
      return {
        initialBalance: initialBalances.get(userId) ?? null,
        movements: movements.filter((movement) => movement.userId === userId),
      };
    },
    async upsertInitialBalance(userId, amount) {
      calls.push(`balance:${userId}:${amount}`);
      initialBalances.set(userId, amount);
      return amount;
    },
    async createMovement(userId, input) {
      calls.push(`create:${userId}`);
      const movement = makeMovement({
        id: `${movements.length + 1}`,
        userId,
        ...input,
      });
      movements.push(movement);
      return movement;
    },
    async findMovementForUser(userId, movementId) {
      calls.push(`find:${userId}:${movementId}`);
      return movements.find((movement) => movement.userId === userId && movement.id === movementId) ?? null;
    },
    async updateMovement(userId, movementId, input) {
      calls.push(`update:${userId}:${movementId}`);
      const index = movements.findIndex((movement) => movement.userId === userId && movement.id === movementId);
      if (index === -1) return null;

      movements[index] = { ...movements[index], ...input };
      return movements[index];
    },
    async deleteMovement(userId, movementId) {
      calls.push(`delete:${userId}:${movementId}`);
      const index = movements.findIndex((movement) => movement.userId === userId && movement.id === movementId);
      if (index === -1) return false;

      movements.splice(index, 1);
      return true;
    },
  };
}

function makeApp(user: AuthUser, repository: MoneyRepository) {
  const app = express();
  app.use(express.json());
  app.use("/money", createMoneyRouter(repository, authAs(user)));
  return app;
}

describe("money routes", () => {
  it("returns only the authenticated user's money", async () => {
    const repo = makeRepository([makeMovement({ userId: jere.id }), makeMovement({ id: "other", userId: gio.id })]);
    const app = makeApp(jere, repo);

    const response = await request(app).get("/money");

    assert.equal(response.status, 200);
    assert.equal(response.body.movements.length, 1);
    assert.equal(response.body.movements[0].userId, jere.id);
    assert.deepEqual(repo.calls, [`get:${jere.id}`]);
  });

  it("does not let an admin read another user's initial balance", async () => {
    const repo = makeRepository();
    const app = makeApp(gio, repo);

    const response = await request(app).get(`/money?userId=${jere.id}`);

    assert.equal(response.status, 200);
    assert.deepEqual(repo.calls, [`get:${gio.id}`]);
    assert.equal(response.body.initialBalance, null);
  });

  it("updates only the authenticated user's initial balance", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app).put("/money/initial-balance").send({ userId: gio.id, amount: 50000 });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { initialBalance: 50000 });
    assert.deepEqual(repo.calls, [`balance:${jere.id}:50000`]);
  });

  it("stores a valid expense", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app).post("/money/movements").send({
      userId: gio.id,
      type: "expense",
      amount: 3200,
      category: "Comida",
      movementDate: "2026-08-29",
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.movement.userId, jere.id);
    assert.equal(response.body.movement.amount, 3200);
    assert.equal(response.body.movement.category, "Comida");
    assert.deepEqual(repo.calls, [`create:${jere.id}`]);
  });

  it("stores a valid income with null category", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app).post("/money/movements").send({
      type: "income",
      amount: 10000,
      category: null,
      movementDate: "2026-08-29",
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.movement.type, "income");
    assert.equal(response.body.movement.category, null);
  });

  it("rejects invalid categories, including Transporte", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const invalid = await request(app).post("/money/movements").send({
      type: "expense",
      amount: 100,
      category: "Ropa",
      movementDate: "2026-08-29",
    });
    const transporte = await request(app).post("/money/movements").send({
      type: "expense",
      amount: 100,
      category: "Transporte",
      movementDate: "2026-08-29",
    });

    assert.equal(invalid.status, 400);
    assert.equal(transporte.status, 400);
  });

  it("rejects non-positive movement amounts", async () => {
    const repo = makeRepository();
    const app = makeApp(jere, repo);

    const response = await request(app).post("/money/movements").send({
      type: "income",
      amount: 0,
      movementDate: "2026-08-29",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "amount_must_be_positive_integer");
  });

  it("only lets users update and delete their own movements", async () => {
    const own = makeMovement({ id: "own", userId: jere.id });
    const other = makeMovement({ id: "other", userId: gio.id });
    const repo = makeRepository([own, other]);
    const app = makeApp(jere, repo);

    const deniedPatch = await request(app).patch("/money/movements/other").send({ amount: 2000 });
    const allowedPatch = await request(app).patch("/money/movements/own").send({ amount: 2500 });
    const deniedDelete = await request(app).delete("/money/movements/other");
    const allowedDelete = await request(app).delete("/money/movements/own");

    assert.equal(deniedPatch.status, 404);
    assert.equal(allowedPatch.status, 200);
    assert.equal(allowedPatch.body.movement.amount, 2500);
    assert.equal(deniedDelete.status, 404);
    assert.equal(allowedDelete.status, 204);
  });
});
