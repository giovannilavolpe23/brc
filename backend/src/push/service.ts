import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { env } from "../config/env";
import { dateKeyDaysBeforeArgentina } from "../dates/trip-date";
import { postgresPushRepository, type PushRepository } from "./repository";
import type { PushPayload, PushSubscriptionRecord } from "./types";

export type PushSender = {
  sendNotification(subscription: WebPushSubscription, payload: string): Promise<unknown>;
};

export type PushConfig = {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
};

export type PushService = {
  isConfigured(): boolean;
  publicKey(): string | null;
  sendTest(userId: string, endpoint?: string): Promise<number>;
  sendDailyReminders(now?: Date): Promise<{ dateKey: string; usersChecked: number; sent: number }>;
  notifyStatsReadyIfComplete(dateKey: string): Promise<{ sent: boolean; deliveries: number }>;
};

const defaultConfig: PushConfig = {
  vapidPublicKey: env.vapidPublicKey,
  vapidPrivateKey: env.vapidPrivateKey,
  vapidSubject: env.vapidSubject,
};

let vapidConfigured = false;

export function createPushService(
  repository: PushRepository = postgresPushRepository,
  sender: PushSender = webpush,
  config: PushConfig = defaultConfig
): PushService {
  function isConfigured(): boolean {
    return !!(config.vapidPublicKey && config.vapidPrivateKey && config.vapidSubject);
  }

  function ensureConfigured(): void {
    if (!isConfigured()) throw new Error("push_not_configured");
    if (!vapidConfigured) {
      webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
      vapidConfigured = true;
    }
  }

  async function sendPayload(subscriptions: PushSubscriptionRecord[], payload: PushPayload): Promise<number> {
    ensureConfigured();
    let sent = 0;
    const body = JSON.stringify(payload);
    for (const subscription of subscriptions) {
      try {
        await sender.sendNotification(toWebPushSubscription(subscription), body);
        sent += 1;
      } catch (error) {
        if (isGonePushSubscription(error)) {
          await repository.deleteSubscriptionByEndpoint(subscription.endpoint);
          continue;
        }
        console.warn("Web Push delivery failed.", safePushError(error));
      }
    }
    return sent;
  }

  return {
    isConfigured,
    publicKey() {
      return config.vapidPublicKey || null;
    },

    async sendTest(userId, endpoint) {
      const subscriptions = await repository.listSubscriptionsForUser(userId, endpoint);
      return sendPayload(subscriptions, {
        title: "Notificaciones funcionando",
        body: "Bariloche ya puede mandarte notificaciones.",
        url: "#/home",
        type: "test",
      });
    },

    async sendDailyReminders(now = new Date()) {
      const dateKey = dateKeyDaysBeforeArgentina(1, now);
      const missingUserIds = await repository.listActiveUserIdsMissingDailyEntry(dateKey);
      let sent = 0;
      for (const userId of missingUserIds) {
        const shouldSend = await repository.markDailyReminderIfNew(dateKey, userId);
        if (!shouldSend) continue;
        const subscriptions = await repository.listSubscriptionsForUsers([userId]);
        sent += await sendPayload(subscriptions, {
          title: "¡No olvides de hacer tu registro!",
          body: "Completá lo de ayer cuando puedas.",
          url: "#/daily",
          type: "daily-reminder",
        });
      }
      return { dateKey, usersChecked: missingUserIds.length, sent };
    },

    async notifyStatsReadyIfComplete(dateKey) {
      const allReady = await repository.allActiveUsersHaveDailyEntry(dateKey);
      if (!allReady) return { sent: false, deliveries: 0 };
      const shouldSend = await repository.markStatsReadyIfNew(dateKey);
      if (!shouldSend) return { sent: false, deliveries: 0 };
      const userIds = await repository.listActiveUserIds();
      const subscriptions = await repository.listSubscriptionsForUsers(userIds);
      const deliveries = await sendPayload(subscriptions, {
        title: "¡Ya están disponibles las estadisticas de ayer!",
        body: "Entrá a ver cómo quedó el día.",
        url: `#/stats?date=${encodeURIComponent(dateKey)}`,
        type: "stats-ready",
      });
      return { sent: true, deliveries };
    },
  };
}

export const pushService = createPushService();

function toWebPushSubscription(subscription: PushSubscriptionRecord): WebPushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  };
}

function isGonePushSubscription(error: unknown): boolean {
  const statusCode = typeof error === "object" && error !== null ? (error as { statusCode?: unknown }).statusCode : null;
  return statusCode === 404 || statusCode === 410;
}

function safePushError(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") return { message: String(error) };
  const maybeError = error as { name?: unknown; message?: unknown; statusCode?: unknown };
  return {
    name: maybeError.name,
    message: maybeError.message,
    statusCode: maybeError.statusCode,
  };
}
