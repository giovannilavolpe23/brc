export type DailyEntryInput = {
  sleep: {
    didNotSleep: boolean;
    bedtime: string | null;
    wake: string | null;
  };
  nap: {
    start: string;
    end: string;
  } | null;
  fifthMeal: "yes" | "no" | null;
  bathroom: number | null;
  boliche: {
    didNotGo: boolean;
    entryTime: string | null;
    time: string | null;
    closedClub: boolean;
  };
};

export type DailyEntry = DailyEntryInput & {
  id: string;
  userId: string;
  dateKey: string;
  createdAt: string;
  updatedAt: string;
};
