import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class InternalNotesDto {
  @ApiProperty({
    description:
      'Replaces the application internal notes. STAFF-only — never shown to the applicant.',
  })
  @IsString()
  @MaxLength(4000)
  internalNotes!: string;
}
