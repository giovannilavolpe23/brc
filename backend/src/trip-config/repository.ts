import { pool } from "../db/pool";
import { DEFAULT_CLUB_TIME_CONFIG, validateClubTimeConfig, type ClubTimeConfig } from "../time/night-club";

type TripConfigRow = {
  club_open_time: string | null;
  club_close_time: string | null;
};

type QueryClient = {
  query: typeof pool.query;
};

export type TripConfig = ClubTimeConfig;

export type TripConfigRepository = {
  getConfig(): Promise<TripConfig>;
  updateClubTimes(config: ClubTimeConfig): Promise<TripConfig>;
};

export const defaultTripConfig: TripConfig = {
  ...DEFAULT_CLUB_TIME_CONFIG,
};

export const postgresTripConfigRepository: TripConfigRepository = {
  async getConfig() {
    return getTripConfig(pool);
  },
  async updateClubTimes(config) {
    return updateTripConfig(pool, config);
  },
};

export async function getTripConfig(client: QueryClient = pool): Promise<TripConfig> {
  const result = await client.query<TripConfigRow>(
    `
      select club_open_time::text, club_close_time::text
      from trip_config
      where id = true
    `
  );
  if (!result.rows[0]) return defaultTripConfig;
  return toTripConfig(result.rows[0]);
}

export async function updateTripConfig(client: QueryClient, config: ClubTimeConfig): Promise<TripConfig> {
  const validated = validateClubTimeConfig(config);
  const result = await client.query<TripConfigRow>(
    `
      insert into trip_config (id, club_open_time, club_close_time, updated_at)
      values (true, $1::time, $2::time, now())
      on conflict (id) do update
      set club_open_time = excluded.club_open_time,
          club_close_time = excluded.club_close_time,
          updated_at = now()
      returning club_open_time::text, club_close_time::text
    `,
    [validated.openTime, validated.closeTime]
  );
  return toTripConfig(result.rows[0]);
}

function toTripConfig(row: TripConfigRow): TripConfig {
  return validateClubTimeConfig({
    openTime: toTime(row.club_open_time) ?? defaultTripConfig.openTime,
    closeTime: toTime(row.club_close_time) ?? defaultTripConfig.closeTime,
  });
}

function toTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}
