import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectApplicationDto {
  @ApiProperty({
    description:
      'Professional, applicant-facing rejection message. Shown verbatim to the applicant.',
    example: 'Thank you for applying. We are unable to offer you a place in this intake.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({
    description: 'STAFF-only rejection discussion — never shown to the applicant.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;
}
