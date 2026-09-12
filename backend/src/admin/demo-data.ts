import { randomUUID } from "node:crypto";
import { Router, type RequestHandler } from "express";
import type { PoolClient } from "pg";
import { evaluateAchievementsThroughDate } from "../achievements/evaluation";
import { requireAuth, requireRole } from "../auth/middleware";
import { pool } from "../db/pool";
import { todayInArgentina } from "../dates/trip-date";
import type { DevResetSummary } from "./dev-reset";

const EXPENSE_CATEGORIES = ["Chocolates", "Alcohol", "Boliche", "Comida", "Bebida", "Actividades", "Otros"] as const;
const DEMO_SURVEY_KEYS = ["destroyed_vote", "most_flirty", "best_outfit"] as const;
const PRESERVED_TABLES = ["users", "roles", "permissions", "user_permissions", "survey_questions", "initial_balances"];
const FULL_TRIP_NIGHTS = 8;
const BOLICHE_CLOSED_CLUB_TIME = "06:45";
const LATEST_REGULAR_BOLICHE_EXIT_MINUTES = timeToMinutes(BOLICHE_CLOSED_CLUB_TIME) - 1;

export type DemoUser = {
  id: string;
  legacyId: string;
  displayName: string;
  role: string;
  permissions: string[];
};

type ActiveUserRow = {
  id: string;
  legacy_id: string;
  display_name: string;
  role_key: string;
  permissions: string[] | null;
};

type DemoDailyEntry = {
  userId: string;
  dateKey: string;
  sleepDidNotSleep: boolean;
  sleepBedtime: string | null;
  sleepWake: string | null;
  napStart: string | null;
  napEnd: string | null;
  fifthMeal: "yes" | "no";
  bathroomCount: number;
  bolicheDidNotGo: boolean;
  bolicheEntryTime: string | null;
  bolicheExitTime: string | null;
  bolicheClosedClub: boolean;
};

type DemoSurveyVote = {
  surveyKey: (typeof DEMO_SURVEY_KEYS)[number];
  dateKey: string;
  voterUserId: string;
  votedUserId: string;
};

type DemoMoneyMovement = {
  userId: string;
  legacyId: string;
  type: "expense" | "income";
  amount: number;
  category: (typeof EXPENSE_CATEGORIES)[number] | null;
  description: string;
  movementDate: string;
};

type DemoPreviaProduct = {
  legacyId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

type DemoPrevia = {
  legacyId: string;
  creatorUserId: string;
  totalAmount: number;
  amountPerParticipant: number;
  occurredAt: string;
  products: DemoPreviaProduct[];
  participantIds: string[];
};

export type GeneratedDemoDataset = {
  users: DemoUser[];
  days: string[];
  dailyEntries: DemoDailyEntry[];
  surveyVotes: DemoSurveyVote[];
  moneyMovements: DemoMoneyMovement[];
  previas: DemoPrevia[];
};

export type DemoSimulationMode = "full_trip" | "yesterday";

export type GeneratedDemoSummary = {
  mode: DemoSimulationMode;
  nights: 1 | 8;
  days: string[];
  users: number;
  deleted: DevResetSummary;
  generated: {
    dailyEntries: number;
    surveyVotes: number;
    moneyMovements: number;
    previas: number;
    previaProducts: number;
    previaParticipants: number;
  };
  preserved: string[];
};

export type DemoDataRepository = {
  generateDemoData(mode: DemoSimulationMode): Promise<GeneratedDemoSummary>;
};

type DemoClient = Pick<PoolClient, "query" | "release">;
type DemoQueryClient = Pick<PoolClient, "query">;
type DemoAchievementEvaluator = (dateKey: string, client: DemoQueryClient) => Promise<unknown>;
type Rng = () => number;

export function createPostgresDemoDataRepository(
  connect: () => Promise<DemoClient> = () => pool.connect(),
  todayProvider: () => string = todayInArgentina,
  achievementEvaluator: DemoAchievementEvaluator = (dateKey, client) => evaluateAchievementsThroughDate(dateKey, client, { isDemo: true })
): DemoDataRepository {
  return {
    async generateDemoData(mode) {
      const client = await connect();
      try {
        await client.query("begin");
        const users = await loadActiveUsers(client);
        const dataset = buildDemoDataset(users, mode, todayProvider());
        await assertNoRealDataConflicts(client, dataset.days);
        const deleted = await deleteDemoDataWithClient(client, mode, dataset.days);
        await insertDemoDataset(client, dataset);
        for (const day of dataset.days) {
          await achievementEvaluator(day, client);
        }
        await client.query("commit");
        return summarizeDataset(mode, dataset, deleted);
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

export function createAdminDemoDataRouter(
  repository: DemoDataRepository = createPostgresDemoDataRepository(),
  authMiddleware: RequestHandler = requireAuth
): Router {
  const router = Router();

  router.post("/generate-demo-data", authMiddleware, requireRole("admin"), async (req, res, next) => {
    try {
      const mode = parseSimulationMode(req.body);
      const summary = await repository.generateDemoData(mode);
      res.status(201).json({ ok: true, ...summary });
    } catch (error) {
      if (error instanceof DemoDataValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error instanceof DemoDataConfigurationError) {
        res.status(503).json({ error: error.message, missingSurveys: error.missingSurveys });
        return;
      }
      next(error);
    }
  });

  return router;
}

export const adminDemoDataRouter = createAdminDemoDataRouter();

export class DemoDataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoDataValidationError";
  }
}

export class DemoDataConfigurationError extends Error {
  constructor(message: string, public readonly missingSurveys: string[]) {
    super(message);
    this.name = "DemoDataConfigurationError";
  }
}

export function buildDemoDataset(users: DemoUser[], mode: DemoSimulationMode, todayKey: string, rng: Rng = Math.random): GeneratedDemoDataset {
  const nights = nightsForMode(mode);
  if (users.length < 2) throw new DemoDataValidationError("not_enough_active_users");

  const days = closedDaysBefore(todayKey, nights);
  const orderedUsers = shuffle(users, rng);
  const zombieUser = orderedUsers[0];
  const alcoholUser = orderedUsers[1 % orderedUsers.length];
  const clubCloserUser = orderedUsers[2 % orderedUsers.length];
  const secretEconomyUser = orderedUsers[5 % orderedUsers.length];
  const surveyFavorites = {
    destroyed_vote: zombieUser,
    most_flirty: orderedUsers[3 % orderedUsers.length],
    best_outfit: orderedUsers[4 % orderedUsers.length],
  };
  const spenderUser = orderedUsers[3 % orderedUsers.length];
  const batchId = randomUUID();

  const dailyEntries: DemoDailyEntry[] = [];
  const surveyVotes: DemoSurveyVote[] = [];
  const moneyMovements: DemoMoneyMovement[] = [];

  days.forEach((dateKey, dayIndex) => {
    users.forEach((user, userIndex) => {
      dailyEntries.push(generateDailyEntry(user, dateKey, dayIndex, { zombieUser, clubCloserUser }, rng));
      DEMO_SURVEY_KEYS.forEach((surveyKey) => {
        const favoriteUser = surveyKey === "best_outfit" && dayIndex === 0 ? surveyFavorites.most_flirty : surveyFavorites[surveyKey];
        surveyVotes.push(generateSurveyVote(surveyKey, user, users, dateKey, dayIndex, favoriteUser, rng));
      });
      moneyMovements.push(...generateMoneyMovements(user, dateKey, dayIndex, userIndex, { alcoholUser, spenderUser, secretComboUser: zombieUser, secretEconomyUser, batchId }, rng));
    });
  });

  return {
    users,
    days,
    dailyEntries,
    surveyVotes,
    moneyMovements,
    previas: generatePrevias(users, days, allowedPreviaCreators(users), batchId, rng),
  };
}

function parseSimulationMode(body: unknown): DemoSimulationMode {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new DemoDataValidationError("invalid_body");
  }
  const mode = (body as { mode?: unknown }).mode;
  if (mode !== "full_trip" && mode !== "yesterday") throw new DemoDataValidationError("invalid_simulation_mode");
  return mode;
}

async function loadActiveUsers(client: DemoQueryClient): Promise<DemoUser[]> {
  const result = await client.query<ActiveUserRow>(
    `
      select users.id,
             users.legacy_id,
             users.display_name,
             roles.key as role_key,
             coalesce(array_remove(array_agg(permissions.key), null), '{}'::text[]) as permissions
      from users
      join roles on roles.id = users.role_id
      left join user_permissions on user_permissions.user_id = users.id
      left join permissions on permissions.id = user_permissions.permission_id
      where users.is_active = true
      group by users.id, users.legacy_id, users.display_name, roles.key
      order by users.display_name
    `
  );
  return result.rows.map((row) => ({
    id: row.id,
    legacyId: row.legacy_id,
    displayName: row.display_name,
    role: row.role_key,
    permissions: row.permissions ?? [],
  }));
}

async function insertDemoDataset(client: DemoQueryClient, dataset: GeneratedDemoDataset): Promise<void> {
  const surveyQuestion = await client.query<{ id: string; key: string }>("select id, key from survey_questions where key = any($1::text[]) and is_active = true", [DEMO_SURVEY_KEYS]);
  const surveyQuestionIds = new Map(surveyQuestion.rows.map((row) => [row.key, row.id]));
  const missingSurveys = DEMO_SURVEY_KEYS.filter((key) => !surveyQuestionIds.has(key));
  if (missingSurveys.length) throw new DemoDataConfigurationError("daily_surveys_not_found", missingSurveys);

  for (const entry of dataset.dailyEntries) {
    await client.query(
      `
        insert into daily_entries (
          user_id, date_key, sleep_did_not_sleep, sleep_bedtime, sleep_wake,
          nap_start, nap_end, fifth_meal, bathroom_count, boliche_did_not_go, boliche_entry_time, boliche_exit_time, boliche_closed_club, is_demo
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
      `,
      [
        entry.userId,
        entry.dateKey,
        entry.sleepDidNotSleep,
        entry.sleepBedtime,
        entry.sleepWake,
        entry.napStart,
        entry.napEnd,
        entry.fifthMeal,
        entry.bathroomCount,
        entry.bolicheDidNotGo,
        entry.bolicheEntryTime,
        entry.bolicheExitTime,
        entry.bolicheClosedClub,
      ]
    );
  }

  for (const vote of dataset.surveyVotes) {
    const surveyQuestionId = surveyQuestionIds.get(vote.surveyKey);
    if (!surveyQuestionId) throw new DemoDataConfigurationError("daily_surveys_not_found", [vote.surveyKey]);
    await client.query(
      `
        insert into survey_votes (survey_question_id, date_key, voter_user_id, voted_user_id, is_demo)
        values ($1, $2, $3, $4, true)
      `,
      [surveyQuestionId, vote.dateKey, vote.voterUserId, vote.votedUserId]
    );
  }

  for (const movement of dataset.moneyMovements) {
    await client.query(
      `
        insert into money_movements (user_id, legacy_id, type, amount_pesos, category, description, movement_date, is_demo)
        values ($1, $2, $3, $4, $5, $6, $7, true)
      `,
      [movement.userId, movement.legacyId, movement.type, movement.amount, movement.category, movement.description, movement.movementDate]
    );
  }

  for (const previa of dataset.previas) {
    const created = await client.query<{ id: string }>(
      `
        insert into previas (legacy_id, creator_user_id, total_amount_pesos, amount_per_participant_pesos, occurred_at, is_demo)
        values ($1, $2, $3, $4, $5, true)
        returning id
      `,
      [previa.legacyId, previa.creatorUserId, previa.totalAmount, previa.amountPerParticipant, previa.occurredAt]
    );
    const previaId = created.rows[0].id;
    for (const product of previa.products) {
      await client.query(
        `
          insert into previa_products (previa_id, legacy_id, name, unit_price_pesos, quantity)
          values ($1, $2, $3, $4, $5)
        `,
        [previaId, product.legacyId, product.name, product.unitPrice, product.quantity]
      );
    }
    for (const userId of previa.participantIds) {
      await client.query("insert into previa_participants (previa_id, user_id) values ($1, $2)", [previaId, userId]);
    }
  }
}

async function assertNoRealDataConflicts(client: DemoQueryClient, days: string[]): Promise<void> {
  const result = await client.query<{ total: string | number }>(
    `
      select (
        (select count(*) from daily_entries where is_demo = false and date_key = any($1::date[])) +
        (select count(*) from survey_votes where is_demo = false and date_key = any($1::date[])) +
        (select count(*) from money_movements where is_demo = false and movement_date = any($1::date[])) +
        (
          select count(*)
          from previas
          where is_demo = false
            and ((occurred_at at time zone 'America/Argentina/Buenos_Aires')::date - 1) = any($1::date[])
        )
      ) as total
    `,
    [days]
  );
  if (Number(result.rows[0]?.total ?? 0) > 0) throw new DemoDataValidationError("demo_data_conflicts");
}

async function deleteDemoDataWithClient(client: DemoQueryClient, mode: DemoSimulationMode, days: string[]): Promise<DevResetSummary> {
  const dayFilter = mode === "full_trip" ? "" : "and ((occurred_at at time zone 'America/Argentina/Buenos_Aires')::date - 1) = any($1::date[])";
  const dayParams = mode === "full_trip" ? [] : [days];
  const datePredicate = mode === "full_trip" ? "is_demo = true" : "is_demo = true and date_key = any($1::date[])";
  const movementPredicate = mode === "full_trip" ? "is_demo = true" : "is_demo = true and movement_date = any($1::date[])";
  const previaIdQuery = `select id from previas where is_demo = true ${dayFilter}`;

  const achievementUnlocks = await client.query(
    mode === "full_trip"
      ? "delete from achievement_unlocks where is_demo = true"
      : "delete from achievement_unlocks where is_demo = true and unlocked_date = any($1::date[])",
    mode === "full_trip" ? [] : [days]
  );
  const achievementResolutions = await client.query(
    mode === "full_trip"
      ? "delete from achievement_resolutions where is_demo = true"
      : "delete from achievement_resolutions where is_demo = true and unlocked_date = any($1::date[])",
    mode === "full_trip" ? [] : [days]
  );
  const previaParticipants = await client.query(`delete from previa_participants where previa_id in (${previaIdQuery})`, dayParams);
  const previaProducts = await client.query(`delete from previa_products where previa_id in (${previaIdQuery})`, dayParams);
  const previas = await client.query(`delete from previas where is_demo = true ${dayFilter}`, dayParams);
  const surveyVotes = await client.query(`delete from survey_votes where ${datePredicate}`, mode === "full_trip" ? [] : [days]);
  const dailyEntries = await client.query(`delete from daily_entries where ${datePredicate}`, mode === "full_trip" ? [] : [days]);
  const moneyMovements = await client.query(`delete from money_movements where ${movementPredicate}`, mode === "full_trip" ? [] : [days]);

  return {
    achievementUnlocks: achievementUnlocks.rowCount ?? 0,
    achievementResolutions: achievementResolutions.rowCount ?? 0,
    moneyMovements: moneyMovements.rowCount ?? 0,
    dailyEntries: dailyEntries.rowCount ?? 0,
    surveyVotes: surveyVotes.rowCount ?? 0,
    previas: previas.rowCount ?? 0,
    previaProducts: previaProducts.rowCount ?? 0,
    previaParticipants: previaParticipants.rowCount ?? 0,
    initialBalances: 0,
  };
}

function summarizeDataset(mode: DemoSimulationMode, dataset: GeneratedDemoDataset, deleted: DevResetSummary): GeneratedDemoSummary {
  return {
    mode,
    nights: nightsForMode(mode),
    days: dataset.days,
    users: dataset.users.length,
    deleted,
    generated: {
      dailyEntries: dataset.dailyEntries.length,
      surveyVotes: dataset.surveyVotes.length,
      moneyMovements: dataset.moneyMovements.length,
      previas: dataset.previas.length,
      previaProducts: dataset.previas.reduce((sum, previa) => sum + previa.products.length, 0),
      previaParticipants: dataset.previas.reduce((sum, previa) => sum + previa.participantIds.length, 0),
    },
    preserved: PRESERVED_TABLES,
  };
}

function generateDailyEntry(
  user: DemoUser,
  dateKey: string,
  dayIndex: number,
  specialUsers: { zombieUser: DemoUser; clubCloserUser: DemoUser },
  rng: Rng
): DemoDailyEntry {
  const { zombieUser, clubCloserUser } = specialUsers;
  const isZombieRun = user.id === zombieUser.id && dayIndex < 4;
  const isCompetitionSeed = user.id === zombieUser.id && dayIndex === 0;
  const isClubClosingRun = user.id === clubCloserUser.id && dayIndex < 6;
  const sleepDidNotSleep = !isZombieRun && rng() < 0.04;
  const sleepBedtime = sleepDidNotSleep
    ? null
    : minutesToTime(isCompetitionSeed ? 420 : isClubClosingRun ? randStep(rng, 420, 480) : isZombieRun ? randStep(rng, 420, 460) : randStep(rng, 240, 390));
  const sleepWake = sleepDidNotSleep ? null : minutesToTime(isCompetitionSeed ? 470 : isClubClosingRun ? randStep(rng, 720, 900) : isZombieRun ? randStep(rng, 540, 600) : randStep(rng, 660, 840));
  const wakeMinutes = sleepWake ? timeToMinutes(sleepWake) : null;

  const hasNap = !sleepDidNotSleep && wakeMinutes !== null && rng() < (isZombieRun ? 0.25 : 0.48);
  let napStart: string | null = null;
  let napEnd: string | null = null;
  if (hasNap && wakeMinutes !== null) {
    const startMinutes = randStep(rng, Math.max(660, wakeMinutes + 60), 1170);
    const endMinutes = Math.min(startMinutes + pick(rng, [30, 40, 60, 80, 100, 120]), 1320);
    napStart = minutesToTime(startMinutes);
    napEnd = minutesToTime(Math.max(endMinutes, startMinutes + 10));
  }

  const bolicheClosingCapacity = sleepDidNotSleep ? timeToMinutes(BOLICHE_CLOSED_CLUB_TIME) : sleepBedtime ? timeToMinutes(sleepBedtime) - 10 : 0;
  const bolicheLatest = sleepDidNotSleep
    ? LATEST_REGULAR_BOLICHE_EXIT_MINUTES
    : sleepBedtime
      ? Math.min(LATEST_REGULAR_BOLICHE_EXIT_MINUTES, timeToMinutes(sleepBedtime) - 10)
      : 0;
  const closedClub = isClubClosingRun && bolicheClosingCapacity >= timeToMinutes(BOLICHE_CLOSED_CLUB_TIME);
  const wentToBoliche = closedClub || (bolicheLatest >= 80 && (isCompetitionSeed || rng() < (isZombieRun ? 0.82 : 0.62)));
  const bolicheEntryTime = wentToBoliche ? minutesToTime(closedClub ? randStep(rng, 70, 180) : randStep(rng, 70, Math.min(220, bolicheLatest - 20))) : null;

  return {
    userId: user.id,
    dateKey,
    sleepDidNotSleep,
    sleepBedtime,
    sleepWake,
    napStart,
    napEnd,
    fifthMeal: isCompetitionSeed || rng() < (isZombieRun ? 0.65 : 0.46) ? "yes" : "no",
    bathroomCount: isCompetitionSeed ? 4 : randInt(rng, 0, 4),
    bolicheDidNotGo: !wentToBoliche,
    bolicheEntryTime,
    bolicheExitTime: wentToBoliche && !closedClub && bolicheEntryTime ? minutesToTime(isCompetitionSeed ? bolicheLatest : randStep(rng, timeToMinutes(bolicheEntryTime) + 10, bolicheLatest)) : null,
    bolicheClosedClub: closedClub,
  };
}

function generateSurveyVote(
  surveyKey: (typeof DEMO_SURVEY_KEYS)[number],
  user: DemoUser,
  users: DemoUser[],
  dateKey: string,
  dayIndex: number,
  favoriteUser: DemoUser,
  rng: Rng
): DemoSurveyVote {
  let votedUser = dayIndex < 4 && user.id !== favoriteUser.id
    ? favoriteUser
    : pick(rng, users.filter((candidate) => candidate.id !== user.id));
  if (votedUser.id === user.id) {
    votedUser = users.find((candidate) => candidate.id !== user.id) ?? votedUser;
  }
  return {
    surveyKey,
    dateKey,
    voterUserId: user.id,
    votedUserId: votedUser.id,
  };
}

function generateMoneyMovements(
  user: DemoUser,
  dateKey: string,
  dayIndex: number,
  userIndex: number,
  context: { alcoholUser: DemoUser; spenderUser: DemoUser; secretComboUser: DemoUser; secretEconomyUser: DemoUser; batchId: string },
  rng: Rng
): DemoMoneyMovement[] {
  const movements: DemoMoneyMovement[] = [];
  let sequence = 0;
  const addMovement = (type: "expense" | "income", amount: number, category: (typeof EXPENSE_CATEGORIES)[number] | null, description: string) => {
    sequence += 1;
    movements.push({
      userId: user.id,
      legacyId: `demo-${context.batchId}-${user.legacyId}-${dateKey}-${sequence}`,
      type,
      amount,
      category,
      description,
      movementDate: dateKey,
    });
  };

  if (user.id === context.secretEconomyUser.id && dayIndex === 1) {
    addMovement("income", randStep(rng, 5000, 20000, 500), null, "Ingreso sin gastar");
    return movements;
  }

  const requiredCategory = EXPENSE_CATEGORIES[(dayIndex + userIndex) % EXPENSE_CATEGORIES.length];
  const categories = new Set<(typeof EXPENSE_CATEGORIES)[number]>([requiredCategory, pick(rng, EXPENSE_CATEGORIES)]);
  if (user.id === context.alcoholUser.id && dayIndex < 4) categories.add("Alcohol");
  if (user.id === context.secretComboUser.id && dayIndex === 0) categories.add("Alcohol");
  if (user.id === context.spenderUser.id && dayIndex < 4) categories.add(pick(rng, ["Boliche", "Actividades", "Comida"]));

  Array.from(categories).forEach((category) => {
    const secretAlcohol = user.id === context.secretComboUser.id && category === "Alcohol" && dayIndex === 0;
    const dominantAlcohol = user.id === context.alcoholUser.id && category === "Alcohol" && dayIndex < 4;
    const dominantSpender = user.id === context.spenderUser.id && dayIndex < 4;
    const baseAmount = secretAlcohol
      ? randStep(rng, 30000, 42000, 500)
      : dominantAlcohol
      ? randStep(rng, 15000, 26000, 500)
      : dominantSpender
        ? randStep(rng, 18000, 32000, 500)
        : randStep(rng, 1200, 12000, 100);
    addMovement("expense", baseAmount, category, expenseDescription(category, rng));
  });

  if (rng() < 0.28) {
    addMovement("income", randStep(rng, 5000, 30000, 500), null, pick(rng, ["Ganancia en cartas", "Me prestaron plata", "Cambio de dólares"]));
  }

  return movements;
}

function generatePrevias(users: DemoUser[], days: string[], creators: DemoUser[], batchId: string, rng: Rng): DemoPrevia[] {
  if (!creators.length) throw new DemoDataValidationError("no_previa_creators_available");
  const previaCount = days.length === 1 ? 1 : Math.max(4, days.length - 1);
  const productNames = ["Fernet", "Coca", "Hielo", "Cerveza", "Vodka", "Jugo", "Snacks"];

  return Array.from({ length: previaCount }, (_, index) => {
    const dateKey = days[index % days.length];
    const shuffledUsers = shuffle(users, rng);
    const participantCount = Math.min(users.length, randInt(rng, Math.min(2, users.length), Math.min(8, users.length)));
    const participantIds = shuffledUsers.slice(0, participantCount).map((user) => user.id);
    const products = Array.from({ length: randInt(rng, 2, 4) }, (__, productIndex) => ({
      legacyId: `demo-product-${batchId}-${index + 1}-${productIndex + 1}`,
      name: pick(rng, productNames),
      unitPrice: randStep(rng, 1200, 8500, 100),
      quantity: randInt(rng, 1, 4),
    }));
    const totalAmount = products.reduce((sum, product) => sum + product.unitPrice * product.quantity, 0);
    return {
      legacyId: `demo-previa-${batchId}-${index + 1}`,
      creatorUserId: creators[index % creators.length].id,
      totalAmount,
      amountPerParticipant: Math.round(totalAmount / participantIds.length),
      occurredAt: `${addDays(dateKey, 1)}T03:${String(randStep(rng, 0, 50, 10)).padStart(2, "0")}:00-03:00`,
      products,
      participantIds,
    };
  });
}

function allowedPreviaCreators(users: DemoUser[]): DemoUser[] {
  return users.filter((user) => user.role === "admin" || user.permissions.includes("create_previa"));
}

function expenseDescription(category: (typeof EXPENSE_CATEGORIES)[number], rng: Rng): string {
  const descriptions: Record<(typeof EXPENSE_CATEGORIES)[number], string[]> = {
    Chocolates: ["Cofler", "Bon o Bon", "Alfajor", "Milka"],
    Alcohol: ["Fernet", "Cerveza", "Gin tonic", "Vodka"],
    Boliche: ["Entrada", "Guardarropa", "Trago en barra"],
    Comida: ["Hamburguesa", "Empanadas", "Pizza", "Panchos"],
    Bebida: ["Agua", "Gatorade", "Coca Cola", "Jugo"],
    Actividades: ["Excursión", "Alquiler", "Circuito chico"],
    Otros: ["Farmacia", "Recuerdo", "Carga de celular"],
  };
  return pick(rng, descriptions[category]);
}

function nightsForMode(mode: DemoSimulationMode): 1 | 8 {
  if (mode === "full_trip") return FULL_TRIP_NIGHTS;
  if (mode === "yesterday") return 1;
  throw new DemoDataValidationError("invalid_simulation_mode");
}

function closedDaysBefore(todayKey: string, nights: 1 | 8): string[] {
  return Array.from({ length: nights }, (_, index) => addDays(todayKey, index - nights));
}

function addDays(dateKey: string, offset: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return date.toISOString().slice(0, 10);
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randStep(rng: Rng, min: number, max: number, step = 10): number {
  const normalizedMin = Math.ceil(min / step) * step;
  const normalizedMax = Math.floor(max / step) * step;
  if (normalizedMax <= normalizedMin) return normalizedMin;
  return normalizedMin + randInt(rng, 0, Math.floor((normalizedMax - normalizedMin) / step)) * step;
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
