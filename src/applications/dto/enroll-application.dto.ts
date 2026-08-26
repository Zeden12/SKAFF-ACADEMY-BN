import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class EnrollApplicationDto {
  @ApiPropertyOptional({
    description:
      'Optional ClassGroup to assign immediately. Must belong to the same Program and Intake as the application — otherwise left unassigned for later assignment.',
  })
  @IsOptional()
  @IsString()
  classGroupId?: string;
}
