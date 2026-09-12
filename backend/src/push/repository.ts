import { pool } from "../db/pool";
import type { PushSubscriptionInput, PushSubscriptionRecord } from "./types";

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

export type PushRepository = {
  upsertSubscription(userId: string, subscription: PushSubscriptionInput, userAgent: string | null): Promise<PushSubscriptionRecord>;
  deleteSubscription(userId: string, endpoint: string): Promise<boolean>;
  deleteSubscriptionByEndpoint(endpoint: string): Promise<void>;
  countSubscriptionsForUser(userId: string): Promise<number>;
  listSubscriptionsForUser(userId: string, endpoint?: string): Promise<PushSubscriptionRecord[]>;
  listSubscriptionsForUsers(userIds: string[]): Promise<PushSubscriptionRecord[]>;
  listActiveUserIds(): Promise<string[]>;
  listActiveUserIdsMissingDailyEntry(dateKey: string): Promise<string[]>;
  allActiveUsersHaveDailyEntry(dateKey: string): Promise<boolean>;
  hasDailyReminderBeenSent(dateKey: string, userId: string): Promise<boolean>;
  markDailyReminderIfNew(dateKey: string, userId: string): Promise<boolean>;
  markStatsReadyIfNew(dateKey: string): Promise<boolean>;
};

export const postgresPushRepository: PushRepository = {
  async upsertSubscription(userId, subscription, userAgent) {
    const result = await pool.query<PushSubscriptionRow>(
      `
        insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
        values ($1, $2, $3, $4, $5)
        on conflict (endpoint) do update
        set user_id = excluded.user_id,
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            user_agent = excluded.user_agent,
            updated_at = now()
        returning id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at
      `,
      [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, userAgent]
    );
    return toPushSubscription(result.rows[0]);
  },

  async deleteSubscription(userId, endpoint) {
    const result = await pool.query("delete from push_subscriptions where user_id = $1 and endpoint = $2", [userId, endpoint]);
    return (result.rowCount || 0) > 0;
  },

  async deleteSubscriptionByEndpoint(endpoint) {
    await pool.query("delete from push_subscriptions where endpoint = $1", [endpoint]);
  },

  async countSubscriptionsForUser(userId) {
    const result = await pool.query<{ count: string }>("select count(*)::text as count from push_subscriptions where user_id = $1", [userId]);
    return Number(result.rows[0]?.count || 0);
  },

  async listSubscriptionsForUser(userId, endpoint) {
    const params = endpoint ? [userId, endpoint] : [userId];
    const where = endpoint ? "where user_id = $1 and endpoint = $2" : "where user_id = $1";
    const result = await pool.query<PushSubscriptionRow>(
      `
        select id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at
        from push_subscriptions
        ${where}
        order by updated_at desc
      `,
      params
    );
    return result.rows.map(toPushSubscription);
  },

  async listSubscriptionsForUsers(userIds) {
    if (!userIds.length) return [];
    const result = await pool.query<PushSubscriptionRow>(
      `
        select id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at
        from push_subscriptions
        where user_id = any($1::uuid[])
        order by updated_at desc
      `,
      [userIds]
    );
    return result.rows.map(toPushSubscription);
  },

  async listActiveUserIds() {
    const result = await pool.query<{ id: string }>("select id from users where is_active = true order by created_at asc, display_name asc");
    return result.rows.map((row) => row.id);
  },

  async listActiveUserIdsMissingDailyEntry(dateKey) {
    const result = await pool.query<{ id: string }>(
      `
        select users.id
        from users
        left join daily_entries on daily_entries.user_id = users.id and daily_entries.date_key = $1
        where users.is_active = true and daily_entries.id is null
        order by users.created_at asc, users.display_name asc
      `,
      [dateKey]
    );
    return result.rows.map((row) => row.id);
  },

  async allActiveUsersHaveDailyEntry(dateKey) {
    const result = await pool.query<{ active_count: string; entry_count: string }>(
      `
        select
          count(users.id)::text as active_count,
          count(daily_entries.id)::text as entry_count
        from users
        left join daily_entries on daily_entries.user_id = users.id and daily_entries.date_key = $1
        where users.is_active = true
      `,
      [dateKey]
    );
    const row = result.rows[0];
    const activeCount = Number(row?.active_count || 0);
    const entryCount = Number(row?.entry_count || 0);
    return activeCount > 0 && activeCount === entryCount;
  },

  async hasDailyReminderBeenSent(dateKey, userId) {
    const result = await pool.query<{ exists: boolean }>(
      "select exists(select 1 from push_daily_reminders where date_key = $1 and user_id = $2) as exists",
      [dateKey, userId]
    );
    return result.rows[0]?.exists === true;
  },

  async markDailyReminderIfNew(dateKey, userId) {
    const result = await pool.query(
      `
        insert into push_daily_reminders (date_key, user_id)
        values ($1, $2)
        on conflict do nothing
      `,
      [dateKey, userId]
    );
    return (result.rowCount || 0) > 0;
  },

  async markStatsReadyIfNew(dateKey) {
    const result = await pool.query(
      `
        insert into push_stats_ready_notifications (date_key)
        values ($1)
        on conflict do nothing
      `,
      [dateKey]
    );
    return (result.rowCount || 0) > 0;
  },
};

function toPushSubscription(row: PushSubscriptionRow): PushSubscriptionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
    userAgent: row.user_agent,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
