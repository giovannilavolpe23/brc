import assert from "node:assert/strict";
import { describe, it } from "node:test";
import webpush from "web-push";
import { createPushService, type PushSender } from "../src/push/service";
import type { PushRepository } from "../src/push/repository";
import type { PushSubscriptionRecord } from "../src/push/types";

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";

function subscription(id: string, userId: string, endpoint = `https://push.example/${id}`): PushSubscriptionRecord {
  return {
    id,
    userId,
    endpoint,
    keys: {
      p256dh: `p256dh-${id}`,
      auth: `auth-${id}`,
    },
    userAgent: null,
    createdAt: "2026-08-29T12:00:00.000Z",
    updatedAt: "2026-08-29T12:00:00.000Z",
  };
}

function makeRepository(options: { missing?: string[]; allReady?: boolean; dailyAlreadySent?: boolean; statsAlreadySent?: boolean } = {}) {
  const calls: string[] = [];
  const repo: PushRepository & { calls: string[] } = {
    calls,
    async upsertSubscription() {
      throw new Error("not used");
    },
    async deleteSubscription() {
      throw new Error("not used");
    },
    async deleteSubscriptionByEndpoint(endpoint) {
      calls.push(`delete:${endpoint}`);
    },
    async countSubscriptionsForUser() {
      throw new Error("not used");
    },
    async listSubscriptionsForUser(userId, endpoint) {
      calls.push(`list-user:${userId}:${endpoint || "*"}`);
      return [subscription("single", userId, endpoint || "https://push.example/single")];
    },
    async listSubscriptionsForUsers(userIds) {
      calls.push(`list-users:${userIds.join(",")}`);
      return userIds.map((userId, index) => subscription(`sub-${index}`, userId));
    },
    async listActiveUserIds() {
      calls.push("active-users");
      return [userA, userB];
    },
    async listActiveUserIdsMissingDailyEntry(dateKey) {
      calls.push(`missing:${dateKey}`);
      return options.missing ?? [userA, userB];
    },
    async allActiveUsersHaveDailyEntry(dateKey) {
      calls.push(`ready:${dateKey}`);
      return options.allReady ?? true;
    },
    async markDailyReminderIfNew(dateKey, userId) {
      calls.push(`mark-reminder:${dateKey}:${userId}`);
      return !options.dailyAlreadySent;
    },
    async markStatsReadyIfNew(dateKey) {
      calls.push(`mark-stats:${dateKey}`);
      return !options.statsAlreadySent;
    },
  };
  return repo;
}

function makeSender(failStatusCode?: number): PushSender & { payloads: string[] } {
  const payloads: string[] = [];
  return {
    payloads,
    async sendNotification(_subscription, payload) {
      payloads.push(payload);
      if (failStatusCode) {
        const error = new Error("push failed") as Error & { statusCode?: number };
        error.statusCode = failStatusCode;
        throw error;
      }
    },
  };
}

function makeConfig() {
  const vapid = webpush.generateVAPIDKeys();
  return {
    vapidPublicKey: vapid.publicKey,
    vapidPrivateKey: vapid.privateKey,
    vapidSubject: "mailto:test@example.com",
  };
}

describe("push service", () => {
  it("sends daily reminders once per user for yesterday in Argentina", async () => {
    const repo = makeRepository({ missing: [userA, userB] });
    const sender = makeSender();
    const service = createPushService(repo, sender, makeConfig());

    const result = await service.sendDailyReminders(new Date("2026-08-29T13:00:00.000Z"));

    assert.equal(result.dateKey, "2026-08-28");
    assert.equal(result.usersChecked, 2);
    assert.equal(result.sent, 2);
    assert.equal(sender.payloads.length, 2);
    assert.deepEqual(repo.calls, [
      "missing:2026-08-28",
      `mark-reminder:2026-08-28:${userA}`,
      `list-users:${userA}`,
      `mark-reminder:2026-08-28:${userB}`,
      `list-users:${userB}`,
    ]);
  });

  it("does not resend daily reminders already marked for the date", async () => {
    const repo = makeRepository({ missing: [userA], dailyAlreadySent: true });
    const sender = makeSender();
    const service = createPushService(repo, sender, makeConfig());

    const result = await service.sendDailyReminders(new Date("2026-08-29T13:00:00.000Z"));

    assert.equal(result.sent, 0);
    assert.equal(sender.payloads.length, 0);
    assert.deepEqual(repo.calls, ["missing:2026-08-28", `mark-reminder:2026-08-28:${userA}`]);
  });

  it("sends stats-ready once when every active user has the daily entry", async () => {
    const repo = makeRepository({ allReady: true });
    const sender = makeSender();
    const service = createPushService(repo, sender, makeConfig());

    const result = await service.notifyStatsReadyIfComplete("2026-08-28");

    assert.deepEqual(result, { sent: true, deliveries: 2 });
    assert.equal(sender.payloads.length, 2);
    assert.ok(sender.payloads.every((payload) => payload.includes("#/stats?date=2026-08-28")));
    assert.deepEqual(repo.calls, ["ready:2026-08-28", "mark-stats:2026-08-28", "active-users", `list-users:${userA},${userB}`]);
  });

  it("does not send stats-ready when not all users are complete or it was already sent", async () => {
    const incomplete = createPushService(makeRepository({ allReady: false }), makeSender(), makeConfig());
    const alreadySentRepo = makeRepository({ allReady: true, statsAlreadySent: true });
    const alreadySentSender = makeSender();
    const alreadySent = createPushService(alreadySentRepo, alreadySentSender, makeConfig());

    assert.deepEqual(await incomplete.notifyStatsReadyIfComplete("2026-08-28"), { sent: false, deliveries: 0 });
    assert.deepEqual(await alreadySent.notifyStatsReadyIfComplete("2026-08-28"), { sent: false, deliveries: 0 });
    assert.equal(alreadySentSender.payloads.length, 0);
  });

  it("removes expired subscriptions and continues after push failures", async () => {
    const repo = makeRepository();
    const sender = makeSender(410);
    const service = createPushService(repo, sender, makeConfig());

    const sent = await service.sendTest(userA);

    assert.equal(sent, 0);
    assert.deepEqual(repo.calls, [`list-user:${userA}:*`, "delete:https://push.example/single"]);
  });
});
