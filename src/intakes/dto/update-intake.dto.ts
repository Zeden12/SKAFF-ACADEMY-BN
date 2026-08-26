import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateIntakeDto } from './create-intake.dto';

// programId is intentionally immutable after creation — moving an intake to
// a different program would silently orphan/mismatch any applications and
// class groups that already reference it under the original program.
export class UpdateIntakeDto extends PartialType(
  OmitType(CreateIntakeDto, ['programId'] as const),
) {}
