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

function makeRepository(
  options: {
    missing?: string[];
    allReady?: boolean;
    dailyAlreadySent?: boolean;
    statsAlreadySent?: boolean;
    activeUserIds?: string[];
    subscriptionsByUser?: Record<string, PushSubscriptionRecord[]>;
  } = {}
) {
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
      if (!endpoint && options.subscriptionsByUser && options.subscriptionsByUser[userId]) return options.subscriptionsByUser[userId];
      return [subscription("single", userId, endpoint || "https://push.example/single")];
    },
    async listSubscriptionsForUsers(userIds) {
      calls.push(`list-users:${userIds.join(",")}`);
      if (options.subscriptionsByUser) return userIds.flatMap((userId) => options.subscriptionsByUser?.[userId] || []);
      return userIds.map((userId, index) => subscription(`sub-${index}`, userId));
    },
    async listActiveUserIds() {
      calls.push("active-users");
      return options.activeUserIds ?? [userA, userB];
    },
    async listActiveUserIdsMissingDailyEntry(dateKey) {
      calls.push(`missing:${dateKey}`);
      return options.missing ?? [userA, userB];
    },
    async allActiveUsersHaveDailyEntry(dateKey) {
      calls.push(`ready:${dateKey}`);
      return options.allReady ?? true;
    },
    async hasDailyReminderBeenSent(dateKey, userId) {
      calls.push(`sent-reminder:${dateKey}:${userId}`);
      return options.dailyAlreadySent ?? false;
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

function makeSender(failStatusCode?: number | ((endpoint: string) => number | undefined)): PushSender & { payloads: string[]; endpoints: string[] } {
  const payloads: string[] = [];
  const endpoints: string[] = [];
  return {
    payloads,
    endpoints,
    async sendNotification(subscription, payload) {
      payloads.push(payload);
      endpoints.push(subscription.endpoint);
      const statusCode = typeof failStatusCode === "function" ? failStatusCode(subscription.endpoint) : failStatusCode;
      if (statusCode) {
        const error = new Error("push failed") as Error & { statusCode?: number };
        error.statusCode = statusCode;
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
  it("sends an individual test only to all subscriptions for that user", async () => {
    const repo = makeRepository({
      subscriptionsByUser: {
        [userA]: [subscription("phone", userA), subscription("desktop", userA)],
        [userB]: [subscription("other", userB)],
      },
    });
    const sender = makeSender();
    const service = createPushService(repo, sender, makeConfig());

    const sent = await service.sendTest(userA);

    assert.equal(sent, 2);
    assert.deepEqual(repo.calls, [`list-user:${userA}:*`]);
    assert.deepEqual(sender.endpoints, ["https://push.example/phone", "https://push.example/desktop"]);
    assert.equal(sender.payloads.every((payload) => payload.includes("Esta notificación solo fue enviada a tu cuenta.")), true);
  });

  it("sends a global test to active users with subscriptions", async () => {
    const userWithoutSubscription = "33333333-3333-4333-8333-333333333333";
    const repo = makeRepository({
      activeUserIds: [userA, userB, userWithoutSubscription],
      subscriptionsByUser: {
        [userA]: [subscription("phone", userA), subscription("desktop", userA)],
        [userB]: [subscription("tablet", userB)],
        [userWithoutSubscription]: [],
      },
    });
    const sender = makeSender();
    const service = createPushService(repo, sender, makeConfig());

    const result = await service.sendGlobalTest();

    assert.deepEqual(result, { usersChecked: 3, sent: 3 });
    assert.deepEqual(repo.calls, ["active-users", `list-users:${userA},${userB},${userWithoutSubscription}`]);
    assert.deepEqual(sender.endpoints, ["https://push.example/phone", "https://push.example/desktop", "https://push.example/tablet"]);
    assert.equal(sender.payloads.every((payload) => payload.includes("Esta es una prueba enviada a todos los usuarios.")), true);
  });

  it("sends daily reminders once per user for yesterday in Argentina", async () => {
    const repo = makeRepository({ missing: [userA, userB] });
    const sender = makeSender();
    const service = createPushService(repo, sender, makeConfig());

    const result = await service.sendDailyReminders(new Date("2026-08-29T13:00:00.000Z"));

    assert.equal(result.dateKey, "2026-08-28");
    assert.equal(result.usersChecked, 2);
    assert.equal(result.activeUsers, 2);
    assert.equal(result.missingUsers, 2);
    assert.equal(result.subscribedUsers, 2);
    assert.equal(result.sent, 2);
    assert.equal(result.failed, 0);
    assert.equal(sender.payloads.length, 2);
    assert.deepEqual(repo.calls, [
      "active-users",
      "missing:2026-08-28",
      `sent-reminder:2026-08-28:${userA}`,
      `list-users:${userA}`,
      `mark-reminder:2026-08-28:${userA}`,
      `sent-reminder:2026-08-28:${userB}`,
      `list-users:${userB}`,
      `mark-reminder:2026-08-28:${userB}`,
    ]);
  });

  it("does not resend daily reminders already marked for the date", async () => {
    const repo = makeRepository({ missing: [userA], dailyAlreadySent: true });
    const sender = makeSender();
    const service = createPushService(repo, sender, makeConfig());

    const result = await service.sendDailyReminders(new Date("2026-08-29T13:00:00.000Z"));

    assert.equal(result.sent, 0);
    assert.equal(sender.payloads.length, 0);
    assert.deepEqual(repo.calls, ["active-users", "missing:2026-08-28", `sent-reminder:2026-08-28:${userA}`]);
  });

  it("does not mark a daily reminder as sent when the missing user has no subscriptions", async () => {
    const repo = makeRepository({ missing: [userA], subscriptionsByUser: { [userA]: [] } });
    const sender = makeSender();
    const service = createPushService(repo, sender, makeConfig());

    const result = await service.sendDailyReminders(new Date("2026-08-29T13:00:00.000Z"));

    assert.equal(result.missingUsers, 1);
    assert.equal(result.subscribedUsers, 0);
    assert.equal(result.sent, 0);
    assert.equal(sender.payloads.length, 0);
    assert.deepEqual(repo.calls, [
      "active-users",
      "missing:2026-08-28",
      `sent-reminder:2026-08-28:${userA}`,
      `list-users:${userA}`,
    ]);
  });

  it("uses Argentina's date boundary for reminders around 10:00", async () => {
    const service = createPushService(makeRepository({ missing: [] }), makeSender(), makeConfig());

    const before = await service.sendDailyReminders(new Date("2026-09-12T12:59:00.000Z"));
    const exact = await service.sendDailyReminders(new Date("2026-09-12T13:00:00.000Z"));
    const after = await service.sendDailyReminders(new Date("2026-09-12T13:01:00.000Z"));

    assert.equal(before.dateKey, "2026-09-11");
    assert.equal(exact.dateKey, "2026-09-11");
    assert.equal(after.dateKey, "2026-09-11");
  });

  it("does not mark failed daily reminder deliveries so a later cron can retry", async () => {
    const repo = makeRepository({ missing: [userA] });
    const sender = makeSender(500);
    const service = createPushService(repo, sender, makeConfig());

    const result = await service.sendDailyReminders(new Date("2026-08-29T13:00:00.000Z"));

    assert.equal(result.subscribedUsers, 1);
    assert.equal(result.sent, 0);
    assert.equal(result.failed, 1);
    assert.equal(repo.calls.includes(`mark-reminder:2026-08-28:${userA}`), false);
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

  it("removes expired global test subscriptions and continues with the rest", async () => {
    const repo = makeRepository({
      subscriptionsByUser: {
        [userA]: [subscription("expired", userA), subscription("valid-a", userA)],
        [userB]: [subscription("valid-b", userB)],
      },
    });
    const sender = makeSender((endpoint) => (endpoint.endsWith("/expired") ? 410 : undefined));
    const service = createPushService(repo, sender, makeConfig());

    const result = await service.sendGlobalTest();

    assert.deepEqual(result, { usersChecked: 2, sent: 2 });
    assert.deepEqual(repo.calls, ["active-users", `list-users:${userA},${userB}`, "delete:https://push.example/expired"]);
    assert.deepEqual(sender.endpoints, ["https://push.example/expired", "https://push.example/valid-a", "https://push.example/valid-b"]);
  });
});
