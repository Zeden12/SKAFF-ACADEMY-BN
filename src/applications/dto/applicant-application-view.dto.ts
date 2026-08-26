import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus, EducationLevel } from '@prisma/client';

import { IntakeResponseDto } from '../../intakes/dto/intake-response.dto';
import { ProgramResponseDto } from '../../programs/dto/program-response.dto';
import { ApplicationDocumentSummaryDto } from './application-document-summary.dto';
import { ApplicationHistoryEntryDto } from './application-history-entry.dto';

/**
 * The single response shape returned by every applicant-facing endpoint
 * (create/update/submit/resubmit/status/add-document). Never includes
 * `internalAdminNotes` or non-PUBLIC history entries.
 */
export class ApplicantApplicationViewDto {
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

  @ApiProperty({
    nullable: true,
    description: 'Set when staff request more information or reject the application.',
  })
  applicantFacingMessage!: string | null;

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

  @ApiProperty({ description: 'Whether PATCH .../:reference is currently allowed' })
  canUpdate!: boolean;

  @ApiProperty({ description: 'Whether POST .../:reference/resubmit is currently allowed' })
  canResubmit!: boolean;

  @ApiProperty({ type: ApplicationDocumentSummaryDto, isArray: true })
  documents!: ApplicationDocumentSummaryDto[];

  @ApiProperty({
    type: ApplicationHistoryEntryDto,
    isArray: true,
    description: 'PUBLIC history entries only',
  })
  history!: ApplicationHistoryEntryDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
