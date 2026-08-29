import { expenseCategories, type ExpenseCategory, type MovementInput, type MovementType } from "./types";

const categorySet = new Set<string>(expenseCategories);

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === "string" && categorySet.has(value);
}

export function parseInitialBalance(body: unknown): number {
  const amount = getRecord(body).amount;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0) {
    throw new ValidationError("amount_must_be_non_negative_integer");
  }

  return amount;
}

export function parseMovementInput(body: unknown): MovementInput {
  const record = getRecord(body);
  const type = parseType(record.type);
  const amount = parsePositiveAmount(record.amount);
  const category = parseCategory(type, record.category);
  const description = parseDescription(record.description);
  const movementDate = parseMovementDate(record.movementDate);

  return { type, amount, category, description, movementDate };
}

export function parseMovementPatch(body: unknown, existing: MovementInput): MovementInput {
  const record = getRecord(body);
  const type = "type" in record ? parseType(record.type) : existing.type;
  const amount = "amount" in record ? parsePositiveAmount(record.amount) : existing.amount;
  const category = "category" in record ? parseCategory(type, record.category) : parseCategory(type, existing.category);
  const description = "description" in record ? parseDescription(record.description) : existing.description;
  const movementDate = "movementDate" in record ? parseMovementDate(record.movementDate) : existing.movementDate;

  return { type, amount, category, description, movementDate };
}

function getRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("invalid_body");
  }

  return value as Record<string, unknown>;
}

function parseType(value: unknown): MovementType {
  if (value !== "expense" && value !== "income") {
    throw new ValidationError("invalid_type");
  }

  return value;
}

function parsePositiveAmount(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ValidationError("amount_must_be_positive_integer");
  }

  return value;
}

function parseCategory(type: MovementType, value: unknown): ExpenseCategory | null {
  if (type === "income") {
    if (value !== null && value !== undefined) {
      throw new ValidationError("income_category_must_be_null");
    }

    return null;
  }

  if (!isExpenseCategory(value)) {
    throw new ValidationError("invalid_expense_category");
  }

  return value;
}

function parseDescription(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new ValidationError("invalid_description");
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseMovementDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError("invalid_movement_date");
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ValidationError("invalid_movement_date");
  }

  return value;
}
