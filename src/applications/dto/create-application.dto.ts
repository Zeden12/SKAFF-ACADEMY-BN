import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EducationLevel } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const CURRENT_YEAR = new Date().getFullYear();

export class CreateApplicationDto {
  @ApiProperty({ description: 'Program id (from GET /programs)' })
  @IsString()
  @IsNotEmpty()
  programId!: string;

  @ApiProperty({
    description: 'Intake id (from GET /programs/:slug/intakes/current) — re-verified server-side',
  })
  @IsString()
  @IsNotEmpty()
  intakeId!: string;

  // --- Personal information ---

  @ApiProperty({ example: 'Aline Uwimana' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName!: string;

  @ApiProperty({ example: 'applicant@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '+250700000000', description: 'Include a country calling code' })
  @IsPhoneNumber()
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'Rwandan' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string;

  @ApiPropertyOptional({ example: 'Kigali, Rwanda' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  currentAddress?: string;

  // --- Education ---

  @ApiPropertyOptional({ enum: EducationLevel })
  @IsOptional()
  @IsEnum(EducationLevel)
  highestEducationLevel?: EducationLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  previousInstitution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fieldOfStudy?: string;

  @ApiPropertyOptional({ example: 2024 })
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(CURRENT_YEAR + 1)
  completionYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  educationNotes?: string;
}
