import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { createPreviasRouter } from "../src/previas/routes";
import type { PreviasRepository } from "../src/previas/repository";
import type { Previa, PreviaInput, ResolvedParticipant } from "../src/previas/types";
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

const marto: AuthUser = {
  id: "33333333-3333-4333-8333-333333333333",
  legacyId: "marto",
  displayName: "Marto",
  role: "user",
  permissions: [],
};

const users = new Map<string, ResolvedParticipant>([
  [gio.id, { id: gio.id, legacyId: "gio", displayName: "Gio" }],
  ["gio", { id: gio.id, legacyId: "gio", displayName: "Gio" }],
  [jere.id, { id: jere.id, legacyId: "jere", displayName: "Jere" }],
  ["jere", { id: jere.id, legacyId: "jere", displayName: "Jere" }],
  [marto.id, { id: marto.id, legacyId: "marto", displayName: "Marto" }],
  ["marto", { id: marto.id, legacyId: "marto", displayName: "Marto" }],
]);

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    id: "legacy-previa-1",
    participantIds: ["gio", "jere"],
    products: [
      { id: "prod-1", name: "Fernet", price: 8000, quantity: 1 },
      { id: "prod-2", name: "Coca", price: 2000, quantity: 1 },
    ],
    total: 10000,
    amountPerPerson: 5000,
    createdAt: "2026-08-29T03:00:00.000Z",
    ...overrides,
  };
}

function authAs(user: AuthUser): RequestHandler {
  return (req, _res, next) => {
    req.user = user;
    next();
  };
}

function makePrevia(creatorUserId: string, input: PreviaInput, participants: ResolvedParticipant[]): Previa {
  return {
    id: `uuid-${input.legacyId}`,
    legacyId: input.legacyId,
    creatorUserId,
    totalAmount: input.totalAmount,
    amountPerParticipant: input.amountPerParticipant,
    occurredAt: input.occurredAt,
    createdAt: "2026-08-29T03:00:00.000Z",
    updatedAt: "2026-08-29T03:00:00.000Z",
    participantIds: participants.map((participant) => participant.legacyId),
    participants,
    products: input.products.map((product, index) => ({ id: `product-${index}`, ...product })),
  };
}

function makeRepository(seed: Previa[] = []): PreviasRepository & { previas: Previa[]; calls: string[] } {
  const previas = [...seed];
  const calls: string[] = [];

  return {
    previas,
    calls,
    async resolveParticipants(participantRefs) {
      calls.push(`resolve:${participantRefs.join(",")}`);
      return participantRefs.map((ref) => users.get(ref)).filter((user): user is ResolvedParticipant => Boolean(user));
    },
    async findByLegacyId(legacyId) {
      calls.push(`legacy:${legacyId}`);
      return previas.find((previa) => previa.legacyId === legacyId) ?? null;
    },
    async listVisible(userId, isAdmin) {
      calls.push(`list:${userId}:${isAdmin}`);
      return isAdmin
        ? previas
        : previas.filter(
            (previa) =>
              previa.creatorUserId === userId || previa.participants.some((participant) => participant.id === userId)
          );
    },
    async findVisible(userId, isAdmin, previaId) {
      calls.push(`visible:${userId}:${isAdmin}:${previaId}`);
      assert.equal(typeof previaId, "string");
      const previa = previas.find((item) => item.id === previaId || item.legacyId === previaId) ?? null;
      if (!previa) return null;
      if (isAdmin || previa.creatorUserId === userId || previa.participants.some((participant) => participant.id === userId)) {
        return previa;
      }
      return null;
    },
    async findForMutation(userId, isAdmin, previaId) {
      calls.push(`mutation:${userId}:${isAdmin}:${previaId}`);
      assert.equal(typeof previaId, "string");
      const previa = previas.find((item) => item.id === previaId || item.legacyId === previaId) ?? null;
      if (!previa) return null;
      if (isAdmin || previa.creatorUserId === userId) return previa;
      return null;
    },
    async createPrevia(creatorUserId, input, participants) {
      calls.push(`create:${creatorUserId}`);
      const previa = makePrevia(creatorUserId, input, participants);
      previas.push(previa);
      return previa;
    },
    async updatePrevia(previaId, input, participants) {
      calls.push(`update:${previaId}`);
      const index = previas.findIndex((previa) => previa.id === previaId);
      if (index === -1) return null;
      previas[index] = makePrevia(previas[index].creatorUserId, input, participants);
      return previas[index];
    },
    async deletePrevia(previaId) {
      calls.push(`delete:${previaId}`);
      const index = previas.findIndex((previa) => previa.id === previaId);
      if (index === -1) return false;
      previas.splice(index, 1);
      return true;
    },
  };
}

function makeApp(user: AuthUser, repository: PreviasRepository) {
  const app = express();
  app.use(express.json());
  app.use("/previas", createPreviasRouter(repository, authAs(user)));
  return app;
}

describe("previas routes", () => {
  it("lets Gio create a previa as admin", async () => {
    const repo = makeRepository();
    const response = await request(makeApp(gio, repo)).post("/previas").send(validBody());

    assert.equal(response.status, 201);
    assert.equal(response.body.previa.creatorUserId, gio.id);
    assert.equal(response.body.previa.legacyId, "legacy-previa-1");
  });

  it("lets Jere create a previa with create_previa permission", async () => {
    const repo = makeRepository();
    const response = await request(makeApp(jere, repo)).post("/previas").send(validBody());

    assert.equal(response.status, 201);
    assert.equal(response.body.previa.creatorUserId, jere.id);
  });

  it("rejects creation by a regular user", async () => {
    const repo = makeRepository();
    const response = await request(makeApp(marto, repo)).post("/previas").send(validBody());

    assert.equal(response.status, 403);
  });

  it("rejects duplicate participants and missing participants", async () => {
    const duplicate = await request(makeApp(jere, makeRepository()))
      .post("/previas")
      .send(validBody({ participantIds: ["gio", "gio"] }));
    const missing = await request(makeApp(jere, makeRepository()))
      .post("/previas")
      .send(validBody({ participantIds: ["gio", "missing"] }));

    assert.equal(duplicate.status, 400);
    assert.equal(duplicate.body.error, "duplicate_participants");
    assert.equal(missing.status, 400);
    assert.equal(missing.body.error, "participant_not_found");
  });

  it("rejects invalid products", async () => {
    const badPrice = await request(makeApp(jere, makeRepository()))
      .post("/previas")
      .send(validBody({ products: [{ name: "Fernet", price: 0, quantity: 1 }] }));
    const badQuantity = await request(makeApp(jere, makeRepository()))
      .post("/previas")
      .send(validBody({ products: [{ name: "Fernet", price: 1000, quantity: 0 }] }));

    assert.equal(badPrice.status, 400);
    assert.equal(badQuantity.status, 400);
  });

  it("validates total and amount per participant", async () => {
    const badTotal = await request(makeApp(jere, makeRepository())).post("/previas").send(validBody({ total: 9999 }));
    const badShare = await request(makeApp(jere, makeRepository()))
      .post("/previas")
      .send(validBody({ amountPerPerson: 4999 }));

    assert.equal(badTotal.status, 400);
    assert.equal(badTotal.body.error, "total_amount_mismatch");
    assert.equal(badShare.status, 400);
    assert.equal(badShare.body.error, "amount_per_participant_mismatch");
  });

  it("rejects duplicate previa codes", async () => {
    const input = {
      legacyId: "legacy-previa-1",
      participantIds: ["gio", "jere"],
      products: [{ legacyId: "prod", name: "Fernet", unitPrice: 10000, quantity: 1 }],
      totalAmount: 10000,
      amountPerParticipant: 5000,
      occurredAt: "2026-08-29T03:00:00.000Z",
    };
    const existing = makePrevia(gio.id, input, [users.get("gio") as ResolvedParticipant, users.get("jere") as ResolvedParticipant]);
    const repo = makeRepository([existing]);

    const response = await request(makeApp(jere, repo)).post("/previas").send(validBody());

    assert.equal(response.status, 409);
    assert.equal(response.body.error, "previa_already_exists");
  });

  it("does not expose sensitive user data in reads", async () => {
    const input = {
      legacyId: "legacy-previa-1",
      participantIds: ["gio", "jere"],
      products: [{ legacyId: "prod", name: "Fernet", unitPrice: 10000, quantity: 1 }],
      totalAmount: 10000,
      amountPerParticipant: 5000,
      occurredAt: "2026-08-29T03:00:00.000Z",
    };
    const existing = makePrevia(jere.id, input, [users.get("gio") as ResolvedParticipant, users.get("jere") as ResolvedParticipant]);

    const response = await request(makeApp(gio, makeRepository([existing]))).get("/previas");

    assert.equal(response.status, 200);
    assert.equal(JSON.stringify(response.body).includes("password"), false);
    assert.equal(JSON.stringify(response.body).includes("access_token"), false);
  });

  it("lets admin mutate any previa but does not give Jere admin privileges", async () => {
    const input = {
      legacyId: "legacy-previa-1",
      participantIds: ["gio", "jere"],
      products: [{ legacyId: "prod", name: "Fernet", unitPrice: 10000, quantity: 1 }],
      totalAmount: 10000,
      amountPerParticipant: 5000,
      occurredAt: "2026-08-29T03:00:00.000Z",
    };
    const existing = makePrevia(gio.id, input, [users.get("gio") as ResolvedParticipant, users.get("jere") as ResolvedParticipant]);
    const denied = await request(makeApp(jere, makeRepository([existing]))).patch("/previas/uuid-legacy-previa-1").send(validBody());
    const allowed = await request(makeApp(gio, makeRepository([existing]))).delete("/previas/uuid-legacy-previa-1");

    assert.equal(denied.status, 404);
    assert.equal(allowed.status, 204);
  });
});
