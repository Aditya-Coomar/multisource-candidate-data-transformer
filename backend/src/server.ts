import http from 'node:http';
import app from './app';
import { config } from './config/config';
import logger from './logger';

const server = http.createServer(app);

let isShuttingDown = false;

function startServer(): void {
  server.listen(config.port, () => {
    logger.info('server.started', {
      port: config.port,
      environment: config.env,
    });
  });
}

function shutdown(signal: string, exitCode = 0): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  logger.info('server.shutdown.started', { signal });

  server.close((error) => {
    if (error) {
      logger.error('server.shutdown.failed', { signal, error });
      process.exit(1);
      return;
    }

    logger.info('server.shutdown.completed', { signal });
    process.exit(exitCode);
  });

  setTimeout(() => {
    logger.error('server.shutdown.timeout', { signal });
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error('process.unhandledRejection', { reason });
  shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  logger.error('process.uncaughtException', { error });
  shutdown('uncaughtException', 1);
});

startServer();
