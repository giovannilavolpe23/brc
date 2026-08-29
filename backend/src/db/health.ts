import { pool, checkDatabaseConnection } from "./pool";

async function main(): Promise<void> {
  await checkDatabaseConnection();
  console.log("Database connection ok.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
