import { pool } from "../db/pool";
import type { MoneyMovement, MovementInput, UserMoney } from "./types";

type MovementRow = {
  id: string;
  legacy_id: string | null;
  user_id: string;
  type: "expense" | "income";
  amount_pesos: number;
  category: string | null;
  description: string | null;
  movement_date: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
};

export type MoneyRepository = {
  getUserMoney(userId: string): Promise<UserMoney>;
  upsertInitialBalance(userId: string, amount: number): Promise<number>;
  createMovement(userId: string, input: MovementInput): Promise<MoneyMovement>;
  findMovementForUser(userId: string, movementId: string): Promise<MoneyMovement | null>;
  updateMovement(userId: string, movementId: string, input: MovementInput): Promise<MoneyMovement | null>;
  deleteMovement(userId: string, movementId: string): Promise<boolean>;
};

export const postgresMoneyRepository: MoneyRepository = {
  async getUserMoney(userId) {
    const initialBalance = await pool.query<{ amount_pesos: number }>(
      "select amount_pesos from initial_balances where user_id = $1",
      [userId]
    );
    const movements = await pool.query<MovementRow>(
      `
        select id, legacy_id, user_id, type, amount_pesos, category, description, movement_date, created_at, updated_at
        from money_movements
        where user_id = $1
        order by movement_date desc, created_at desc
      `,
      [userId]
    );

    return {
      initialBalance: initialBalance.rows[0]?.amount_pesos ?? null,
      movements: movements.rows.map(toMoneyMovement),
    };
  },

  async upsertInitialBalance(userId, amount) {
    const result = await pool.query<{ amount_pesos: number }>(
      `
        insert into initial_balances (user_id, amount_pesos)
        values ($1, $2)
        on conflict (user_id) do update
        set amount_pesos = excluded.amount_pesos,
            updated_at = now()
        returning amount_pesos
      `,
      [userId, amount]
    );

    return result.rows[0].amount_pesos;
  },

  async createMovement(userId, input) {
    const result = await pool.query<MovementRow>(
      `
        insert into money_movements (user_id, legacy_id, type, amount_pesos, category, description, movement_date)
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (user_id, legacy_id) where legacy_id is not null do update
        set type = excluded.type,
            amount_pesos = excluded.amount_pesos,
            category = excluded.category,
            description = excluded.description,
            movement_date = excluded.movement_date,
            updated_at = now()
        returning id, legacy_id, user_id, type, amount_pesos, category, description, movement_date, created_at, updated_at
      `,
      [userId, input.legacyId, input.type, input.amount, input.category, input.description, input.movementDate]
    );

    return toMoneyMovement(result.rows[0]);
  },

  async findMovementForUser(userId, movementId) {
    const result = await pool.query<MovementRow>(
      `
        select id, legacy_id, user_id, type, amount_pesos, category, description, movement_date, created_at, updated_at
        from money_movements
        where user_id = $1 and (id::text = $2 or legacy_id = $2)
      `,
      [userId, movementId]
    );

    return result.rows[0] ? toMoneyMovement(result.rows[0]) : null;
  },

  async updateMovement(userId, movementId, input) {
    const result = await pool.query<MovementRow>(
      `
        update money_movements
        set type = $3,
            amount_pesos = $4,
            category = $5,
            description = $6,
            movement_date = $7,
            legacy_id = $8,
            updated_at = now()
        where user_id = $1 and (id::text = $2 or legacy_id = $2)
        returning id, legacy_id, user_id, type, amount_pesos, category, description, movement_date, created_at, updated_at
      `,
      [userId, movementId, input.type, input.amount, input.category, input.description, input.movementDate, input.legacyId]
    );

    return result.rows[0] ? toMoneyMovement(result.rows[0]) : null;
  },

  async deleteMovement(userId, movementId) {
    const result = await pool.query("delete from money_movements where user_id = $1 and (id::text = $2 or legacy_id = $2)", [
      userId,
      movementId,
    ]);
    return Boolean(result.rowCount);
  },
};

function toMoneyMovement(row: MovementRow): MoneyMovement {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    userId: row.user_id,
    type: row.type,
    amount: row.amount_pesos,
    category: row.category as MoneyMovement["category"],
    description: row.description,
    movementDate: toDateOnly(row.movement_date),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function toDateOnly(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
