import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Application,
  ApplicationDocument,
  ApplicationHistoryActorType,
  ApplicationHistoryEntry,
  ApplicationHistoryVisibility,
  ApplicationStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { SequenceService } from '../prisma/sequence.service';
import { ProgramsService } from '../programs/programs.service';
import { isIntakeAcceptingApplications } from '../intakes/intake-eligibility.util';
import { historyEntryData } from './application-history.util';
import { normalizeEmail, normalizeReference } from './application.util';
import { AddApplicationDocumentDto } from './dto/add-application-document.dto';
import { ApplicantApplicationViewDto } from './dto/applicant-application-view.dto';
import { ApplicantVerificationDto } from './dto/applicant-verification.dto';
import { ApplicationDocumentSummaryDto } from './dto/application-document-summary.dto';
import { ApplicationHistoryEntryDto } from './dto/application-history-entry.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { assertValidTransition } from './application-status.policy';

const APPLICATION_INCLUDE = {
  program: true,
  intake: true,
  documents: { orderBy: { createdAt: 'asc' } },
  history: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ApplicationInclude;

export type ApplicationWithRelations = Prisma.ApplicationGetPayload<{
  include: typeof APPLICATION_INCLUDE;
}>;

const EDITABLE_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.DRAFT,
  ApplicationStatus.MORE_INFORMATION_REQUIRED,
];

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceService: SequenceService,
    private readonly programsService: ProgramsService,
  ) {}

  // ---------------------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------------------

  /** STAFF-context lookup — no applicant email check (caller is already authenticated). */
  async findByReference(reference: string): Promise<ApplicationWithRelations> {
    const application = await this.loadWithRelations(reference);

    if (!application) {
      throw new NotFoundException(`Application "${reference}" was not found`);
    }

    return application;
  }

  /**
   * Applicant-context lookup. Deliberately returns the SAME "not found" error
   * whether the reference doesn't exist or the email doesn't match it, so a
   * guessed reference can't be used to confirm another applicant's data
   * exists — see ApplicantVerificationDto for the security model.
   */
  async findVerifiedApplication(
    reference: string,
    verificationEmail: string,
  ): Promise<ApplicationWithRelations> {
    const application = await this.loadWithRelations(reference);

    if (!application || normalizeEmail(application.email) !== normalizeEmail(verificationEmail)) {
      throw new NotFoundException('No application matches that reference and email.');
    }

    return application;
  }

  private async loadWithRelations(reference: string): Promise<ApplicationWithRelations | null> {
    return this.prisma.application.findUnique({
      where: { reference: normalizeReference(reference) },
      include: APPLICATION_INCLUDE,
    });
  }

  // ---------------------------------------------------------------------
  // Applicant-facing operations
  // ---------------------------------------------------------------------

  async create(dto: CreateApplicationDto): Promise<ApplicantApplicationViewDto> {
    const program = await this.programsService.findActiveById(dto.programId);
    const intake = await this.prisma.intake.findUnique({ where: { id: dto.intakeId } });

    if (!intake || intake.programId !== program.id) {
      throw new BadRequestException('The selected intake does not belong to this program.');
    }
    if (!isIntakeAcceptingApplications(intake)) {
      throw new BadRequestException('This intake is not currently accepting applications.');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const reference = await this.sequenceService.nextApplicationReference(tx);

      const application = await tx.application.create({
        data: {
          reference,
          programId: program.id,
          intakeId: intake.id,
          fullName: dto.fullName,
          email: normalizeEmail(dto.email),
          phone: dto.phone,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          nationality: dto.nationality ?? null,
          currentAddress: dto.currentAddress ?? null,
          highestEducationLevel: dto.highestEducationLevel ?? null,
          previousInstitution: dto.previousInstitution ?? null,
          fieldOfStudy: dto.fieldOfStudy ?? null,
          completionYear: dto.completionYear ?? null,
          educationNotes: dto.educationNotes ?? null,
        },
      });

      await tx.applicationHistoryEntry.create({
        data: historyEntryData(
          application.id,
          'Application created',
          ApplicationHistoryActorType.APPLICANT,
          {
            visibility: ApplicationHistoryVisibility.PUBLIC,
          },
        ),
      });

      return application;
    });

    return this.mapToView(await this.findByReference(created.reference));
  }

  async update(reference: string, dto: UpdateApplicationDto): Promise<ApplicantApplicationViewDto> {
    const application = await this.findVerifiedApplication(reference, dto.verificationEmail);
    assertEditable(application);

    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: application.id },
        data: {
          fullName: dto.fullName,
          email: dto.email ? normalizeEmail(dto.email) : undefined,
          phone: dto.phone,
          dateOfBirth:
            dto.dateOfBirth !== undefined
              ? dto.dateOfBirth
                ? new Date(dto.dateOfBirth)
                : null
              : undefined,
          nationality: dto.nationality,
          currentAddress: dto.currentAddress,
          highestEducationLevel: dto.highestEducationLevel,
          previousInstitution: dto.previousInstitution,
          fieldOfStudy: dto.fieldOfStudy,
          completionYear: dto.completionYear,
          educationNotes: dto.educationNotes,
        },
      });

      await tx.applicationHistoryEntry.create({
        data: historyEntryData(
          application.id,
          'Draft updated',
          ApplicationHistoryActorType.APPLICANT,
          {
            visibility: ApplicationHistoryVisibility.PUBLIC,
          },
        ),
      });
    });

    return this.getVerifiedView(reference, dto.verificationEmail);
  }

  async submit(
    reference: string,
    dto: ApplicantVerificationDto,
  ): Promise<ApplicantApplicationViewDto> {
    const application = await this.findVerifiedApplication(reference, dto.verificationEmail);

    if (application.status !== ApplicationStatus.DRAFT) {
      throw new ConflictException('Only draft applications can be submitted.');
    }
    assertValidTransition(application.status, ApplicationStatus.SUBMITTED);
    assertApplicationIsComplete(application);

    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: application.id },
        data: { status: ApplicationStatus.SUBMITTED, submittedAt: new Date() },
      });
      await tx.applicationHistoryEntry.create({
        data: historyEntryData(application.id, 'Submitted', ApplicationHistoryActorType.APPLICANT, {
          visibility: ApplicationHistoryVisibility.PUBLIC,
        }),
      });
    });

    return this.getVerifiedView(reference, dto.verificationEmail);
  }

  async resubmit(
    reference: string,
    dto: ApplicantVerificationDto,
  ): Promise<ApplicantApplicationViewDto> {
    const application = await this.findVerifiedApplication(reference, dto.verificationEmail);

    if (application.status !== ApplicationStatus.MORE_INFORMATION_REQUIRED) {
      throw new ConflictException(
        'Only applications with information requested can be resubmitted.',
      );
    }
    assertValidTransition(application.status, ApplicationStatus.SUBMITTED);
    assertApplicationIsComplete(application);

    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: application.id },
        data: {
          status: ApplicationStatus.SUBMITTED,
          submittedAt: new Date(),
          // The specific ask is preserved verbatim in the history entry
          // created when it was requested — clearing the "live" message
          // here just means there is no longer an outstanding, unresolved ask.
          applicantFacingMessage: null,
        },
      });
      await tx.applicationHistoryEntry.create({
        data: historyEntryData(
          application.id,
          'Applicant resubmitted',
          ApplicationHistoryActorType.APPLICANT,
          {
            visibility: ApplicationHistoryVisibility.PUBLIC,
          },
        ),
      });
    });

    return this.getVerifiedView(reference, dto.verificationEmail);
  }

  async addDocument(
    reference: string,
    dto: AddApplicationDocumentDto,
  ): Promise<ApplicantApplicationViewDto> {
    const application = await this.findVerifiedApplication(reference, dto.verificationEmail);
    assertEditable(application);

    await this.prisma.applicationDocument.create({
      data: {
        applicationId: application.id,
        type: dto.type,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
      },
    });

    return this.getVerifiedView(reference, dto.verificationEmail);
  }

  private async getVerifiedView(
    reference: string,
    verificationEmail: string,
  ): Promise<ApplicantApplicationViewDto> {
    return this.mapToView(await this.findVerifiedApplication(reference, verificationEmail));
  }

  // ---------------------------------------------------------------------
  // Mapping (also used by AdminApplicationsService)
  // ---------------------------------------------------------------------

  mapToView(application: ApplicationWithRelations): ApplicantApplicationViewDto {
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
      submittedAt: application.submittedAt,
      reviewedAt: application.reviewedAt,
      approvedAt: application.approvedAt,
      rejectedAt: application.rejectedAt,
      enrolledAt: application.enrolledAt,
      canUpdate: EDITABLE_STATUSES.includes(application.status),
      canResubmit: application.status === ApplicationStatus.MORE_INFORMATION_REQUIRED,
      documents: application.documents.map(toDocumentSummary),
      history: application.history
        .filter((entry) => entry.visibility === ApplicationHistoryVisibility.PUBLIC)
        .map(toHistoryEntry),
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }
}

export function toDocumentSummary(document: ApplicationDocument): ApplicationDocumentSummaryDto {
  return {
    id: document.id,
    type: document.type,
    fileName: document.fileName,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    createdAt: document.createdAt,
  };
}

export function toHistoryEntry(entry: ApplicationHistoryEntry): ApplicationHistoryEntryDto {
  return {
    id: entry.id,
    action: entry.action,
    actorType: entry.actorType,
    actorName: entry.actorName,
    message: entry.message,
    visibility: entry.visibility,
    createdAt: entry.createdAt,
  };
}

function assertEditable(application: Pick<Application, 'status'>): void {
  if (!EDITABLE_STATUSES.includes(application.status)) {
    throw new ConflictException('This application can no longer be edited.');
  }
}

function assertApplicationIsComplete(
  application: Pick<
    Application,
    'highestEducationLevel' | 'previousInstitution' | 'completionYear'
  >,
): void {
  const missing: string[] = [];
  if (!application.highestEducationLevel) missing.push('highestEducationLevel');
  if (!application.previousInstitution) missing.push('previousInstitution');
  if (!application.completionYear) missing.push('completionYear');

  if (missing.length > 0) {
    throw new BadRequestException(
      `Complete these fields before submitting: ${missing.join(', ')}.`,
    );
  }
}
