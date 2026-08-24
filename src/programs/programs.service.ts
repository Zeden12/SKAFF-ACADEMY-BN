import { Injectable, NotFoundException } from '@nestjs/common';
import { Program } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllActive(): Promise<Program[]> {
    return this.prisma.program.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async findActiveBySlug(slug: string): Promise<Program> {
    const program = await this.prisma.program.findFirst({
      where: { slug, isActive: true },
    });

    if (!program) {
      throw new NotFoundException(`Program with slug "${slug}" was not found`);
    }

    return program;
  }
}
