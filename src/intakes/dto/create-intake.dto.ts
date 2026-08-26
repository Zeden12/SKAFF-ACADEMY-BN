import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntakeStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateIntakeDto {
  @ApiProperty({ description: 'Program this intake belongs to' })
  @IsString()
  @IsNotEmpty()
  programId!: string;

  @ApiProperty({ example: 'Full-Stack Development 2027 Intake' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ enum: IntakeStatus, default: IntakeStatus.UPCOMING })
  @IsOptional()
  @IsEnum(IntakeStatus)
  status?: IntakeStatus;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  applicationsOpen?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  applicationOpenAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  applicationCloseAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
