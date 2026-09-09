import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { createPushRouter } from "../src/push/routes";
import type { AuthUser } from "../src/auth/types";
import type { PushRepository } from "../src/push/repository";
import type { PushService } from "../src/push/service";
import type { PushSubscriptionInput, PushSubscriptionRecord } from "../src/push/types";

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

const subscriptionInput: PushSubscriptionInput = {
  endpoint: "https://push.example/sub-1",
  keys: {
    p256dh: "p256dh-key",
    auth: "auth-key",
  },
};

function authAs(user: AuthUser): RequestHandler {
  return (req, _res, next) => {
    req.user = user;
    next();
  };
}

function adminOnly(): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (req.user.role !== "admin") {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}

function makeRecord(userId: string, subscription: PushSubscriptionInput = subscriptionInput): PushSubscriptionRecord {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    userId,
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    userAgent: "test-agent",
    createdAt: "2026-08-29T12:00:00.000Z",
    updatedAt: "2026-08-29T12:00:00.000Z",
  };
}

function makeRepository(): PushRepository & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async upsertSubscription(userId, subscription) {
      calls.push(`upsert:${userId}:${subscription.endpoint}`);
      return makeRecord(userId, subscription);
    },
    async deleteSubscription(userId, endpoint) {
      calls.push(`delete:${userId}:${endpoint}`);
      return true;
    },
    async deleteSubscriptionByEndpoint(endpoint) {
      calls.push(`delete-endpoint:${endpoint}`);
    },
    async countSubscriptionsForUser(userId) {
      calls.push(`count:${userId}`);
      return 2;
    },
    async listSubscriptionsForUser(userId, endpoint) {
      calls.push(`list-user:${userId}:${endpoint || "*"}`);
      return [makeRecord(userId)];
    },
    async listSubscriptionsForUsers(userIds) {
      calls.push(`list-users:${userIds.join(",")}`);
      return userIds.map((userId) => makeRecord(userId));
    },
    async listActiveUserIds() {
      calls.push("active-users");
      return [gio.id, jere.id];
    },
    async listActiveUserIdsMissingDailyEntry(dateKey) {
      calls.push(`missing:${dateKey}`);
      return [jere.id];
    },
    async allActiveUsersHaveDailyEntry(dateKey) {
      calls.push(`ready:${dateKey}`);
      return true;
    },
    async markDailyReminderIfNew(dateKey, userId) {
      calls.push(`mark-reminder:${dateKey}:${userId}`);
      return true;
    },
    async markStatsReadyIfNew(dateKey) {
      calls.push(`mark-stats:${dateKey}`);
      return true;
    },
  };
}

function makeService(configured = true): PushService & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    isConfigured: () => configured,
    publicKey: () => (configured ? "public-vapid-key" : null),
    async sendTest(userId, endpoint) {
      calls.push(`test:${userId}:${endpoint || "*"}`);
      return 1;
    },
    async sendGlobalTest() {
      calls.push("test-global");
      return { usersChecked: 2, sent: 2 };
    },
    async sendDailyReminders() {
      calls.push("daily-reminders");
      return { dateKey: "2026-08-28", usersChecked: 1, sent: 1 };
    },
    async notifyStatsReadyIfComplete(dateKey) {
      calls.push(`stats-ready:${dateKey}`);
      return { sent: true, deliveries: 2 };
    },
  };
}

function makeApp(user: AuthUser, repository = makeRepository(), service = makeService(), cronSecret = "secret") {
  const app = express();
  app.use(express.json());
  app.use("/push", createPushRouter(repository, service, authAs(user), adminOnly(), cronSecret));
  return { app, repository, service };
}

describe("push routes", () => {
  it("returns notification status for the authenticated user without exposing private keys", async () => {
    const { app, repository } = makeApp(jere);

    const response = await request(app).get("/push/status");

    assert.equal(response.status, 200);
    assert.equal(response.body.configured, true);
    assert.equal(response.body.vapidPublicKey, "public-vapid-key");
    assert.equal(response.body.vapidPrivateKey, undefined);
    assert.equal(response.body.subscriptionCount, 2);
    assert.deepEqual(repository.calls, [`count:${jere.id}`]);
  });

  it("subscribes an authenticated user and validates the payload", async () => {
    const { app, repository } = makeApp(jere);

    const response = await request(app).post("/push/subscribe").send(subscriptionInput);
    const invalid = await request(app).post("/push/subscribe").send({ endpoint: "" });

    assert.equal(response.status, 201);
    assert.equal(response.body.subscription.endpoint, subscriptionInput.endpoint);
    assert.equal(response.body.subscription.keys, undefined);
    assert.equal(invalid.status, 400);
    assert.deepEqual(repository.calls, [`upsert:${jere.id}:${subscriptionInput.endpoint}`]);
  });

  it("does not subscribe when push is not configured", async () => {
    const { app, repository } = makeApp(jere, makeRepository(), makeService(false));

    const response = await request(app).post("/push/subscribe").send(subscriptionInput);

    assert.equal(response.status, 503);
    assert.equal(response.body.error, "push_not_configured");
    assert.deepEqual(repository.calls, []);
  });

  it("unsubscribes only the authenticated user's endpoint", async () => {
    const { app, repository } = makeApp(jere);

    const response = await request(app).delete("/push/unsubscribe").send(subscriptionInput);

    assert.equal(response.status, 204);
    assert.deepEqual(repository.calls, [`delete:${jere.id}:${subscriptionInput.endpoint}`]);
  });

  it("allows only admins to send a manual test notification", async () => {
    const normal = makeApp(jere);
    const admin = makeApp(gio);

    const rejected = await request(normal.app).post("/push/test").send({ endpoint: subscriptionInput.endpoint });
    const sent = await request(admin.app).post("/push/test").send({ endpoint: subscriptionInput.endpoint });

    assert.equal(rejected.status, 403);
    assert.equal(sent.status, 200);
    assert.equal(sent.body.sent, 1);
    assert.deepEqual(admin.service.calls, [`test:${gio.id}:${subscriptionInput.endpoint}`]);
  });

  it("allows only admins to send a global test notification", async () => {
    const normal = makeApp(jere);
    const admin = makeApp(gio);

    const rejected = await request(normal.app).post("/push/test/global").send();
    const sent = await request(admin.app).post("/push/test/global").send();

    assert.equal(rejected.status, 403);
    assert.equal(sent.status, 200);
    assert.equal(sent.body.usersChecked, 2);
    assert.equal(sent.body.sent, 2);
    assert.deepEqual(normal.service.calls, []);
    assert.deepEqual(admin.service.calls, ["test-global"]);
  });

  it("protects the reminder cron route with a shared secret", async () => {
    const { app, service } = makeApp(gio);

    const rejected = await request(app).post("/push/cron/daily-reminders").set("x-cron-secret", "wrong").send();
    const accepted = await request(app).post("/push/cron/daily-reminders").set("x-cron-secret", "secret").send();

    assert.equal(rejected.status, 401);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.dateKey, "2026-08-28");
    assert.deepEqual(service.calls, ["daily-reminders"]);
  });
});
