import { loadConfig } from "./config.js";

const config = loadConfig();
process.stdout.write(
  JSON.stringify({
    status: "ok",
    environment: config.DESK_ENV,
    deployedCommit: config.DEPLOYED_COMMIT,
  }) + "\n",
);
