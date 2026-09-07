export type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type PushSubscriptionRecord = PushSubscriptionInput & {
  id: string;
  userId: string;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  type: "daily-reminder" | "stats-ready" | "test";
};

export class PushValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PushValidationError";
  }
}

export function parsePushSubscriptionInput(body: unknown): PushSubscriptionInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PushValidationError("invalid_subscription");
  }

  const raw = body as Record<string, unknown>;
  const keys = raw.keys;
  if (!keys || typeof keys !== "object" || Array.isArray(keys)) {
    throw new PushValidationError("invalid_subscription_keys");
  }

  const rawKeys = keys as Record<string, unknown>;
  const endpoint = parseSubscriptionString(raw.endpoint, "invalid_endpoint", 4096);
  const p256dh = parseSubscriptionString(rawKeys.p256dh, "invalid_p256dh", 512);
  const auth = parseSubscriptionString(rawKeys.auth, "invalid_auth", 256);

  return {
    endpoint,
    keys: { p256dh, auth },
  };
}

function parseSubscriptionString(value: unknown, error: string, maxLength: number): string {
  if (typeof value !== "string") throw new PushValidationError(error);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) throw new PushValidationError(error);
  return trimmed;
}
