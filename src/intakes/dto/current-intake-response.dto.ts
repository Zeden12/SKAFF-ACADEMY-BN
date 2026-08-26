import { ApiProperty } from '@nestjs/swagger';

import { IntakeResponseDto } from './intake-response.dto';

export class CurrentIntakeResponseDto {
  @ApiProperty({
    description: 'Whether an intake is currently accepting applications for this program',
  })
  available!: boolean;

  @ApiProperty({ type: IntakeResponseDto, nullable: true })
  intake!: IntakeResponseDto | null;

  @ApiProperty({
    nullable: true,
    example: 'Applications are currently closed for this program.',
    description: 'Set when `available` is false — safe to show directly to the applicant.',
  })
  message!: string | null;
}
