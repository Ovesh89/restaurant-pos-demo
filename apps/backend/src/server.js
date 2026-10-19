import { app } from './app.js';
import { env } from './config/env.js';
import { checkMongoConnection, closeMongoConnection } from './config/database.js';

async function startServer() {
  const dbCheck = await checkMongoConnection();
  if (dbCheck.connected) {
    console.log(
      `[MongoDB] Connected to database "${dbCheck.database}" (MongoDB v${dbCheck.version})`
    );
  } else {
    console.warn(
      `[MongoDB] Warning: Database "${dbCheck.database}" not reachable on startup: ${dbCheck.error}`
    );
  }

  const PORT = Number(process.env.PORT || 8001);

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Restaurant POS API listening on port ${PORT}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[${signal}] Shutting down server gracefully...`);
    server.close(async () => {
      await closeMongoConnection();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((err) => {
  console.error('[Fatal Startup Error]', err);
  process.exit(1);
});
