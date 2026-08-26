import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus, EducationLevel } from '@prisma/client';

import { IntakeResponseDto } from '../../intakes/dto/intake-response.dto';
import { ProgramResponseDto } from '../../programs/dto/program-response.dto';
import { ApplicationDocumentSummaryDto } from './application-document-summary.dto';
import { ApplicationHistoryEntryDto } from './application-history-entry.dto';

/** STAFF-only. Includes internal notes and the full (PUBLIC + INTERNAL) history. */
export class AdminApplicationDetailDto {
  @ApiProperty({ example: 'SKA-APP-2026-0001' })
  reference!: string;

  @ApiProperty({ enum: ApplicationStatus })
  status!: ApplicationStatus;

  @ApiProperty({ type: ProgramResponseDto })
  program!: ProgramResponseDto;

  @ApiProperty({ type: IntakeResponseDto })
  intake!: IntakeResponseDto;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty({ nullable: true })
  dateOfBirth!: Date | null;

  @ApiProperty({ nullable: true })
  nationality!: string | null;

  @ApiProperty({ nullable: true })
  currentAddress!: string | null;

  @ApiProperty({ enum: EducationLevel, nullable: true })
  highestEducationLevel!: EducationLevel | null;

  @ApiProperty({ nullable: true })
  previousInstitution!: string | null;

  @ApiProperty({ nullable: true })
  fieldOfStudy!: string | null;

  @ApiProperty({ nullable: true })
  completionYear!: number | null;

  @ApiProperty({ nullable: true })
  educationNotes!: string | null;

  @ApiProperty({ nullable: true })
  applicantFacingMessage!: string | null;

  @ApiProperty({ nullable: true, description: 'STAFF-only — never returned to applicants' })
  internalAdminNotes!: string | null;

  @ApiProperty({ nullable: true })
  submittedAt!: Date | null;

  @ApiProperty({ nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty({ nullable: true })
  approvedAt!: Date | null;

  @ApiProperty({ nullable: true })
  rejectedAt!: Date | null;

  @ApiProperty({ nullable: true })
  enrolledAt!: Date | null;

  @ApiProperty({
    description: 'True when status === APPROVED (eligible for enrollment conversion)',
  })
  enrollmentReadiness!: boolean;

  @ApiProperty({ type: ApplicationDocumentSummaryDto, isArray: true })
  documents!: ApplicationDocumentSummaryDto[];

  @ApiProperty({
    type: ApplicationHistoryEntryDto,
    isArray: true,
    description: 'Full history — PUBLIC and INTERNAL',
  })
  history!: ApplicationHistoryEntryDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
