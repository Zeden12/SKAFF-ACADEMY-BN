import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Single shared PrismaClient instance for the whole application.
 * Feature modules should inject this instead of creating their own client.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Database connection established');
    } catch (error) {
      // Business modules don't exist yet, so we don't hard-crash the process
      // on a transient DB outage at boot. Anything that actually needs the
      // database will fail its own request until connectivity is restored.
      this.logger.error(
        'Could not connect to the database on startup. The application will continue to start.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
