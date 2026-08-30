import type { PreviaInput, PreviaProductInput } from "./types";

export class PreviaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreviaValidationError";
  }
}

export function parsePreviaInput(body: unknown): PreviaInput {
  const record = getRecord(body);
  const legacyId = parseNonBlankString(record.legacyId ?? record.id, "invalid_legacy_id");
  const participantIds = parseParticipantIds(record.participantIds);
  const products = parseProducts(record.products);
  const totalAmount = parsePositiveInteger(record.totalAmount ?? record.total, "invalid_total_amount");
  const occurredAt = parseIsoDate(record.occurredAt ?? record.createdAt, "invalid_occurred_at");

  validateTotalAmount(products, totalAmount);
  const amountPerParticipant = calculateAmountPerParticipant(totalAmount, participantIds.length);

  return { legacyId, participantIds, products, totalAmount, amountPerParticipant, occurredAt };
}

function parseParticipantIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new PreviaValidationError("participants_required");
  }

  const participantIds = value.map((item) => parseNonBlankString(item, "invalid_participant_id"));
  if (new Set(participantIds).size !== participantIds.length) {
    throw new PreviaValidationError("duplicate_participants");
  }

  return participantIds;
}

function parseProducts(value: unknown): PreviaProductInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new PreviaValidationError("products_required");
  }

  return value.map((item) => {
    const product = getRecord(item);
    return {
      legacyId:
        product.legacyId === null || product.legacyId === undefined
          ? product.id === null || product.id === undefined
            ? null
            : parseNonBlankString(product.id, "invalid_product_legacy_id")
          : parseNonBlankString(product.legacyId, "invalid_product_legacy_id"),
      name: parseNonBlankString(product.name, "invalid_product_name"),
      unitPrice: parsePositiveInteger(product.unitPrice ?? product.price, "invalid_product_price"),
      quantity: parsePositiveInteger(product.quantity, "invalid_product_quantity"),
    };
  });
}

function validateTotalAmount(products: PreviaProductInput[], totalAmount: number): void {
  const computedTotal = products.reduce((sum, product) => sum + product.unitPrice * product.quantity, 0);
  if (totalAmount !== computedTotal) {
    throw new PreviaValidationError("total_amount_mismatch");
  }
}

function calculateAmountPerParticipant(totalAmount: number, participantCount: number): number {
  return Math.round(totalAmount / participantCount);
}

function getRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PreviaValidationError("invalid_body");
  }

  return value as Record<string, unknown>;
}

function parseNonBlankString(value: unknown, error: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new PreviaValidationError(error);
  }

  return value.trim();
}

function parsePositiveInteger(value: unknown, error: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new PreviaValidationError(error);
  }

  return value;
}

function parseIsoDate(value: unknown, error: string): string {
  if (typeof value !== "string") {
    throw new PreviaValidationError(error);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new PreviaValidationError(error);
  }

  return date.toISOString();
}
