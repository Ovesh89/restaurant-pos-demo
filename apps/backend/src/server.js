import { app } from './app.js';
import { env } from './config/env.js';
import { checkMongoConnection, closeMongoConnection } from './config/database.js';
import { initAuditCleanupScheduler, stopAuditScheduler } from './modules/audit/scheduler.js';

async function startServer() {
  const dbCheck = await checkMongoConnection();
  if (dbCheck.connected) {
    console.log(
      `[MongoDB] Connected to database "${dbCheck.database}" (MongoDB v${dbCheck.version})`
    );
    // Initialize scheduled background jobs
    initAuditCleanupScheduler();
  } else {
    console.warn(
      `[MongoDB] Warning: Database "${dbCheck.database}" not reachable on startup: ${dbCheck.error}`
    );
  }

  const server = app.listen(env.port, () => {
    console.log(
      `[Restaurant POS MERN Backend] Listening on http://127.0.0.1:${env.port} (env: ${env.nodeEnv})`
    );
  });

  const shutdown = async (signal) => {
    console.log(`\n[${signal}] Shutting down server gracefully...`);
    stopAuditScheduler();
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
