import { ApiPropertyOptional } from '@nestjs/swagger';
import { IntakeStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class AdminIntakeQueryDto {
  @ApiPropertyOptional({ description: 'Filter by program id' })
  @IsOptional()
  @IsString()
  programId?: string;

  @ApiPropertyOptional({ enum: IntakeStatus })
  @IsOptional()
  @IsEnum(IntakeStatus)
  status?: IntakeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  applicationsOpen?: boolean;
}
