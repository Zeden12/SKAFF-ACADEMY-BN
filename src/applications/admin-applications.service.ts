import { ConflictException, Injectable } from '@nestjs/common';
import {
  Application,
  ApplicationHistoryActorType,
  ApplicationHistoryVisibility,
  ApplicationStatus,
  Intake,
  Prisma,
  Program,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { assertValidTransition } from './application-status.policy';
import { historyEntryData } from './application-history.util';
import {
  ApplicationsService,
  ApplicationWithRelations,
  toDocumentSummary,
  toHistoryEntry,
} from './applications.service';
import {
  AdminApplicationSortBy,
  AdminApplicationQueryDto,
  SortDirection,
} from './dto/admin-application-query.dto';
import { AdminApplicationDetailDto } from './dto/admin-application-detail.dto';
import { AdminApplicationListItemDto } from './dto/admin-application-list-item.dto';
import {
  AdminApplicationListResponseDto,
  ApplicationStatusCountsDto,
} from './dto/admin-application-list-response.dto';
import { InternalNotesDto } from './dto/internal-notes.dto';
import { RejectApplicationDto } from './dto/reject-application.dto';
import { RequestInformationDto } from './dto/request-information.dto';

@Injectable()
export class AdminApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applicationsService: ApplicationsService,
  ) {}

  async list(query: AdminApplicationQueryDto): Promise<AdminApplicationListResponseDto> {
    const baseWhere: Prisma.ApplicationWhereInput = {
      programId: query.programId,
      intakeId: query.intakeId,
      ...(query.search
        ? {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' } },
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const where: Prisma.ApplicationWhereInput = { ...baseWhere, status: query.status };

    const [items, total, groups] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: { program: true, intake: true },
        orderBy: buildOrderBy(query.sortBy, query.sortDir),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.application.count({ where }),
      this.prisma.application.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } }),
    ]);

    return {
      items: items.map(toListItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      counts: buildStatusCounts(groups),
    };
  }

  async detail(reference: string): Promise<AdminApplicationDetailDto> {
    return mapToAdminDetail(await this.applicationsService.findByReference(reference));
  }

  async setUnderReview(reference: string, actorName: string): Promise<AdminApplicationDetailDto> {
    const application = await this.applicationsService.findByReference(reference);

    if (application.status !== ApplicationStatus.SUBMITTED) {
      throw new ConflictException('Only submitted applications can be moved to review.');
    }
    assertValidTransition(application.status, ApplicationStatus.UNDER_REVIEW);

    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: application.id },
        data: { status: ApplicationStatus.UNDER_REVIEW, reviewedAt: new Date() },
      });
      await tx.applicationHistoryEntry.create({
        data: historyEntryData(
          application.id,
          'Review started',
          ApplicationHistoryActorType.STAFF,
          {
            actorName,
            visibility: ApplicationHistoryVisibility.PUBLIC,
          },
        ),
      });
    });

    return this.detail(reference);
  }

  async requestInformation(
    reference: string,
    dto: RequestInformationDto,
    actorName: string,
  ): Promise<AdminApplicationDetailDto> {
    const application = await this.applicationsService.findByReference(reference);

    if (application.status !== ApplicationStatus.UNDER_REVIEW) {
      throw new ConflictException('Only applications under review can have information requested.');
    }
    assertValidTransition(application.status, ApplicationStatus.MORE_INFORMATION_REQUIRED);

    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: application.id },
        data: {
          status: ApplicationStatus.MORE_INFORMATION_REQUIRED,
          applicantFacingMessage: dto.message,
        },
      });
      await tx.applicationHistoryEntry.create({
        data: historyEntryData(
          application.id,
          'Additional information requested',
          ApplicationHistoryActorType.STAFF,
          { actorName, message: dto.message, visibility: ApplicationHistoryVisibility.PUBLIC },
        ),
      });
    });

    return this.detail(reference);
  }

  async approve(reference: string, actorName: string): Promise<AdminApplicationDetailDto> {
    const application = await this.applicationsService.findByReference(reference);

    if (application.status !== ApplicationStatus.UNDER_REVIEW) {
      throw new ConflictException('Only applications under review can be approved.');
    }
    assertValidTransition(application.status, ApplicationStatus.APPROVED);

    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: application.id },
        data: { status: ApplicationStatus.APPROVED, approvedAt: new Date() },
      });
      await tx.applicationHistoryEntry.create({
        data: historyEntryData(application.id, 'Approved', ApplicationHistoryActorType.STAFF, {
          actorName,
          visibility: ApplicationHistoryVisibility.PUBLIC,
        }),
      });
    });

    return this.detail(reference);
  }

  async reject(
    reference: string,
    dto: RejectApplicationDto,
    actorName: string,
  ): Promise<AdminApplicationDetailDto> {
    const application = await this.applicationsService.findByReference(reference);

    if (application.status !== ApplicationStatus.UNDER_REVIEW) {
      throw new ConflictException('Only applications under review can be rejected.');
    }
    assertValidTransition(application.status, ApplicationStatus.REJECTED);

    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: application.id },
        data: {
          status: ApplicationStatus.REJECTED,
          rejectedAt: new Date(),
          applicantFacingMessage: dto.message,
        },
      });
      await tx.applicationHistoryEntry.create({
        data: historyEntryData(application.id, 'Rejected', ApplicationHistoryActorType.STAFF, {
          actorName,
          message: dto.message,
          visibility: ApplicationHistoryVisibility.PUBLIC,
        }),
      });
      if (dto.internalNotes) {
        await tx.applicationHistoryEntry.create({
          data: historyEntryData(
            application.id,
            'Internal rejection notes added',
            ApplicationHistoryActorType.STAFF,
            {
              actorName,
              message: dto.internalNotes,
              visibility: ApplicationHistoryVisibility.INTERNAL,
            },
          ),
        });
      }
    });

    return this.detail(reference);
  }

  async updateInternalNotes(
    reference: string,
    dto: InternalNotesDto,
    actorName: string,
  ): Promise<AdminApplicationDetailDto> {
    const application = await this.applicationsService.findByReference(reference);

    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: application.id },
        data: { internalAdminNotes: dto.internalNotes },
      });
      await tx.applicationHistoryEntry.create({
        data: historyEntryData(
          application.id,
          'Internal notes updated',
          ApplicationHistoryActorType.STAFF,
          {
            actorName,
            visibility: ApplicationHistoryVisibility.INTERNAL,
          },
        ),
      });
    });

    return this.detail(reference);
  }
}

function buildOrderBy(
  sortBy: AdminApplicationSortBy,
  sortDir: SortDirection,
): Prisma.ApplicationOrderByWithRelationInput {
  switch (sortBy) {
    case 'submittedAt':
      return { submittedAt: sortDir };
    case 'fullName':
      return { fullName: sortDir };
    case 'status':
      return { status: sortDir };
    case 'createdAt':
    default:
      return { createdAt: sortDir };
  }
}

function toListItem(
  application: Application & { program: Program; intake: Intake },
): AdminApplicationListItemDto {
  return {
    reference: application.reference,
    fullName: application.fullName,
    email: application.email,
    status: application.status,
    programId: application.programId,
    programName: application.program.name,
    intakeId: application.intakeId,
    intakeName: application.intake.name,
    submittedAt: application.submittedAt,
    createdAt: application.createdAt,
  };
}

function buildStatusCounts(
  groups: { status: ApplicationStatus; _count: { _all: number } }[],
): ApplicationStatusCountsDto {
  const counts: ApplicationStatusCountsDto = {
    DRAFT: 0,
    SUBMITTED: 0,
    UNDER_REVIEW: 0,
    MORE_INFORMATION_REQUIRED: 0,
    APPROVED: 0,
    REJECTED: 0,
    ENROLLED: 0,
  };

  for (const group of groups) {
    counts[group.status] = group._count._all;
  }

  return counts;
}

function mapToAdminDetail(application: ApplicationWithRelations): AdminApplicationDetailDto {
  return {
    reference: application.reference,
    status: application.status,
    program: application.program,
    intake: application.intake,
    fullName: application.fullName,
    email: application.email,
    phone: application.phone,
    dateOfBirth: application.dateOfBirth,
    nationality: application.nationality,
    currentAddress: application.currentAddress,
    highestEducationLevel: application.highestEducationLevel,
    previousInstitution: application.previousInstitution,
    fieldOfStudy: application.fieldOfStudy,
    completionYear: application.completionYear,
    educationNotes: application.educationNotes,
    applicantFacingMessage: application.applicantFacingMessage,
    internalAdminNotes: application.internalAdminNotes,
    submittedAt: application.submittedAt,
    reviewedAt: application.reviewedAt,
    approvedAt: application.approvedAt,
    rejectedAt: application.rejectedAt,
    enrolledAt: application.enrolledAt,
    enrollmentReadiness: application.status === ApplicationStatus.APPROVED,
    documents: application.documents.map(toDocumentSummary),
    history: application.history.map(toHistoryEntry),
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}
