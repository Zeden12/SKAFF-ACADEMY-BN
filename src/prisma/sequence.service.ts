import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from './prisma.service';

type SequenceClient = Pick<PrismaService, '$queryRaw'> | Prisma.TransactionClient;

/**
 * Generates server-side, database-backed sequential identifiers (application
 * references, student numbers, ...) via an atomic upsert-increment on
 * `SequenceCounter` — safe under concurrent requests, no read-then-write race.
 * Pass a transaction client to make the increment part of a larger transaction.
 */
@Injectable()
export class SequenceService {
  constructor(private readonly prisma: PrismaService) {}

  async nextApplicationReference(client: SequenceClient = this.prisma): Promise<string> {
    const year = new Date().getFullYear();
    const sequence = await this.next(`application-${year}`, client);
    return `SKA-APP-${year}-${String(sequence).padStart(4, '0')}`;
  }

  async nextStudentNumber(client: SequenceClient = this.prisma): Promise<string> {
    const year = new Date().getFullYear();
    const sequence = await this.next(`student-${year}`, client);
    return `SKF-${year}-${String(sequence).padStart(4, '0')}`;
  }

  private async next(key: string, client: SequenceClient): Promise<number> {
    const rows = await client.$queryRaw<{ value: number }[]>`
      INSERT INTO "SequenceCounter" ("key", "value") VALUES (${key}, 1)
      ON CONFLICT ("key") DO UPDATE SET "value" = "SequenceCounter"."value" + 1
      RETURNING "value";
    `;
    return rows[0].value;
  }
}
