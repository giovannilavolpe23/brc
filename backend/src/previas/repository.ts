import { PoolClient } from "pg";
import { pool } from "../db/pool";
import type { Previa, PreviaInput, PreviaParticipant, PreviaProduct, ResolvedParticipant } from "./types";

type PreviaRow = {
  id: string;
  legacy_id: string;
  creator_user_id: string;
  total_amount_pesos: number;
  amount_per_participant_pesos: number;
  occurred_at: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
};

type ProductRow = {
  id: string;
  legacy_id: string | null;
  name: string;
  unit_price_pesos: number;
  quantity: number;
};

type ParticipantRow = {
  id: string;
  legacy_id: string;
  display_name: string;
};

export type PreviasRepository = {
  resolveParticipants(participantRefs: string[]): Promise<ResolvedParticipant[]>;
  findByLegacyId(legacyId: string): Promise<Previa | null>;
  listVisible(userId: string, isAdmin: boolean): Promise<Previa[]>;
  findVisible(userId: string, isAdmin: boolean, previaId: string): Promise<Previa | null>;
  findForMutation(userId: string, isAdmin: boolean, previaId: string): Promise<Previa | null>;
  createPrevia(creatorUserId: string, input: PreviaInput, participants: ResolvedParticipant[]): Promise<Previa>;
  updatePrevia(previaId: string, input: PreviaInput, participants: ResolvedParticipant[]): Promise<Previa | null>;
  deletePrevia(previaId: string): Promise<boolean>;
};

export const postgresPreviasRepository: PreviasRepository = {
  async resolveParticipants(participantRefs) {
    const result = await pool.query<ParticipantRow>(
      `
        select id, legacy_id, display_name
        from users
        where is_active = true and (id::text = any($1::text[]) or legacy_id = any($1::text[]))
      `,
      [participantRefs]
    );

    return result.rows.map(toResolvedParticipant);
  },

  async findByLegacyId(legacyId) {
    const result = await pool.query<PreviaRow>("select * from previas where legacy_id = $1", [legacyId]);
    return result.rows[0] ? hydratePrevia(result.rows[0]) : null;
  },

  async listVisible(userId, isAdmin) {
    const result = await pool.query<PreviaRow>(
      isAdmin
        ? "select * from previas order by occurred_at desc, created_at desc"
        : `
            select distinct previas.*
            from previas
            left join previa_participants on previa_participants.previa_id = previas.id
            where previas.creator_user_id = $1 or previa_participants.user_id = $1
            order by previas.occurred_at desc, previas.created_at desc
          `,
      isAdmin ? [] : [userId]
    );

    return Promise.all(result.rows.map(hydratePrevia));
  },

  async findVisible(userId, isAdmin, previaId) {
    const result = await pool.query<PreviaRow>(
      isAdmin
        ? "select * from previas where id::text = $1 or legacy_id = $1"
        : `
            select distinct previas.*
            from previas
            left join previa_participants on previa_participants.previa_id = previas.id
            where (previas.id::text = $2 or previas.legacy_id = $2)
              and (previas.creator_user_id = $1 or previa_participants.user_id = $1)
          `,
      isAdmin ? [previaId] : [userId, previaId]
    );

    return result.rows[0] ? hydratePrevia(result.rows[0]) : null;
  },

  async findForMutation(userId, isAdmin, previaId) {
    const result = await pool.query<PreviaRow>(
      isAdmin
        ? "select * from previas where id::text = $1 or legacy_id = $1"
        : "select * from previas where (id::text = $2 or legacy_id = $2) and creator_user_id = $1",
      isAdmin ? [previaId] : [userId, previaId]
    );

    return result.rows[0] ? hydratePrevia(result.rows[0]) : null;
  },

  async createPrevia(creatorUserId, input, participants) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const previa = await insertPrevia(client, creatorUserId, input);
      await replaceProducts(client, previa.id, input);
      await replaceParticipants(client, previa.id, participants);
      await client.query("commit");
      return hydratePrevia(previa);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  },

  async updatePrevia(previaId, input, participants) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const result = await client.query<PreviaRow>(
        `
          update previas
          set legacy_id = $2,
              total_amount_pesos = $3,
              amount_per_participant_pesos = $4,
              occurred_at = $5,
              updated_at = now()
          where id = $1
          returning *
        `,
        [previaId, input.legacyId, input.totalAmount, input.amountPerParticipant, input.occurredAt]
      );
      if (!result.rows[0]) {
        await client.query("rollback");
        return null;
      }

      await replaceProducts(client, previaId, input);
      await replaceParticipants(client, previaId, participants);
      await client.query("commit");
      return hydratePrevia(result.rows[0]);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  },

  async deletePrevia(previaId) {
    const result = await pool.query("delete from previas where id = $1", [previaId]);
    return Boolean(result.rowCount);
  },
};

async function insertPrevia(client: PoolClient, creatorUserId: string, input: PreviaInput): Promise<PreviaRow> {
  const result = await client.query<PreviaRow>(
    `
      insert into previas (legacy_id, creator_user_id, total_amount_pesos, amount_per_participant_pesos, occurred_at)
      values ($1, $2, $3, $4, $5)
      returning *
    `,
    [input.legacyId, creatorUserId, input.totalAmount, input.amountPerParticipant, input.occurredAt]
  );
  return result.rows[0];
}

async function replaceProducts(client: PoolClient, previaId: string, input: PreviaInput): Promise<void> {
  await client.query("delete from previa_products where previa_id = $1", [previaId]);
  for (const product of input.products) {
    await client.query(
      `
        insert into previa_products (previa_id, legacy_id, name, unit_price_pesos, quantity)
        values ($1, $2, $3, $4, $5)
      `,
      [previaId, product.legacyId, product.name, product.unitPrice, product.quantity]
    );
  }
}

async function replaceParticipants(
  client: PoolClient,
  previaId: string,
  participants: ResolvedParticipant[]
): Promise<void> {
  await client.query("delete from previa_participants where previa_id = $1", [previaId]);
  for (const participant of participants) {
    await client.query("insert into previa_participants (previa_id, user_id) values ($1, $2)", [
      previaId,
      participant.id,
    ]);
  }
}

async function hydratePrevia(row: PreviaRow): Promise<Previa> {
  const [products, participants] = await Promise.all([
    pool.query<ProductRow>(
      "select id, legacy_id, name, unit_price_pesos, quantity from previa_products where previa_id = $1 order by created_at, id",
      [row.id]
    ),
    pool.query<ParticipantRow>(
      `
        select users.id, users.legacy_id, users.display_name
        from previa_participants
        join users on users.id = previa_participants.user_id
        where previa_participants.previa_id = $1
        order by users.display_name
      `,
      [row.id]
    ),
  ]);

  const mappedParticipants = participants.rows.map(toPreviaParticipant);

  return {
    id: row.id,
    legacyId: row.legacy_id,
    creatorUserId: row.creator_user_id,
    totalAmount: row.total_amount_pesos,
    amountPerParticipant: row.amount_per_participant_pesos,
    occurredAt: toIso(row.occurred_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    participantIds: mappedParticipants.map((participant) => participant.legacyId),
    participants: mappedParticipants,
    products: products.rows.map(toPreviaProduct),
  };
}

function toResolvedParticipant(row: ParticipantRow): ResolvedParticipant {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    displayName: row.display_name,
  };
}

function toPreviaParticipant(row: ParticipantRow): PreviaParticipant {
  return toResolvedParticipant(row);
}

function toPreviaProduct(row: ProductRow): PreviaProduct {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    name: row.name,
    unitPrice: row.unit_price_pesos,
    quantity: row.quantity,
  };
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
