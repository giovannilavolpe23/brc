import { app } from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`Bariloche API listening on port ${env.port}`);
});
