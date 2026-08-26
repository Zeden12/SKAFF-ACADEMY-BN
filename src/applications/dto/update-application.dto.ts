import { IntersectionType, OmitType, PartialType } from '@nestjs/swagger';

import { ApplicantVerificationDto } from './applicant-verification.dto';
import { CreateApplicationDto } from './create-application.dto';

// Program/intake cannot be changed via update — an applicant who wants a
// different program/intake starts a new application.
class UpdatableApplicationFieldsDto extends PartialType(
  OmitType(CreateApplicationDto, ['programId', 'intakeId'] as const),
) {}

export class UpdateApplicationDto extends IntersectionType(
  ApplicantVerificationDto,
  UpdatableApplicationFieldsDto,
) {}
