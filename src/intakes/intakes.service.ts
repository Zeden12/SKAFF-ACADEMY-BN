import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Intake } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AdminIntakeQueryDto } from './dto/admin-intake-query.dto';
import { CreateIntakeDto } from './dto/create-intake.dto';
import { CurrentIntakeResponseDto } from './dto/current-intake-response.dto';
import { UpdateIntakeDto } from './dto/update-intake.dto';
import { intakeEligibilityWhere } from './intake-eligibility.util';

const NO_OPEN_INTAKE_MESSAGE = 'Applications are currently closed for this program.';

@Injectable()
export class IntakesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public: the latest intake currently accepting applications for a program. */
  async findCurrentEligibleForProgram(programId: string): Promise<CurrentIntakeResponseDto> {
    const intake = await this.prisma.intake.findFirst({
      where: { programId, ...intakeEligibilityWhere() },
      orderBy: { createdAt: 'desc' },
    });

    if (!intake) {
      return { available: false, intake: null, message: NO_OPEN_INTAKE_MESSAGE };
    }

    return { available: true, intake, message: null };
  }

  async adminList(query: AdminIntakeQueryDto): Promise<Intake[]> {
    return this.prisma.intake.findMany({
      where: {
        programId: query.programId,
        status: query.status,
        applicationsOpen: query.applicationsOpen,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminFindOne(id: string): Promise<Intake> {
    const intake = await this.prisma.intake.findUnique({ where: { id } });

    if (!intake) {
      throw new NotFoundException(`Intake "${id}" was not found`);
    }

    return intake;
  }

  async adminCreate(dto: CreateIntakeDto): Promise<Intake> {
    const program = await this.prisma.program.findUnique({ where: { id: dto.programId } });

    if (!program) {
      throw new BadRequestException(`Program "${dto.programId}" was not found`);
    }

    const applicationOpenAt = dto.applicationOpenAt ? new Date(dto.applicationOpenAt) : null;
    const applicationCloseAt = dto.applicationCloseAt ? new Date(dto.applicationCloseAt) : null;
    assertDateWindowIsValid(applicationOpenAt, applicationCloseAt);

    return this.prisma.intake.create({
      data: {
        programId: dto.programId,
        name: dto.name,
        status: dto.status,
        applicationsOpen: dto.applicationsOpen ?? false,
        applicationOpenAt,
        applicationCloseAt,
        capacity: dto.capacity,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async adminUpdate(id: string, dto: UpdateIntakeDto): Promise<Intake> {
    const existing = await this.adminFindOne(id);

    const applicationOpenAt =
      dto.applicationOpenAt !== undefined
        ? dto.applicationOpenAt
          ? new Date(dto.applicationOpenAt)
          : null
        : existing.applicationOpenAt;
    const applicationCloseAt =
      dto.applicationCloseAt !== undefined
        ? dto.applicationCloseAt
          ? new Date(dto.applicationCloseAt)
          : null
        : existing.applicationCloseAt;
    assertDateWindowIsValid(applicationOpenAt, applicationCloseAt);

    return this.prisma.intake.update({
      where: { id },
      data: {
        name: dto.name,
        status: dto.status,
        applicationsOpen: dto.applicationsOpen,
        applicationOpenAt,
        applicationCloseAt,
        capacity: dto.capacity,
        startDate:
          dto.startDate !== undefined
            ? dto.startDate
              ? new Date(dto.startDate)
              : null
            : undefined,
        endDate:
          dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : undefined,
      },
    });
  }

  async setApplicationsOpen(id: string, open: boolean): Promise<Intake> {
    const intake = await this.adminFindOne(id);

    if (open && (intake.status === 'COMPLETED' || intake.status === 'CANCELLED')) {
      throw new BadRequestException(
        'Cannot open applications for a completed or cancelled intake.',
      );
    }

    return this.prisma.intake.update({ where: { id }, data: { applicationsOpen: open } });
  }
}

function assertDateWindowIsValid(openAt: Date | null, closeAt: Date | null): void {
  if (openAt && closeAt && closeAt <= openAt) {
    throw new BadRequestException('applicationCloseAt must be after applicationOpenAt.');
  }
}
