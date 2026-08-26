import { ApiProperty } from '@nestjs/swagger';
import { ApplicationDocumentType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsMimeType,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { ApplicantVerificationDto } from './applicant-verification.dto';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB — sanity bound; no actual file is stored yet.

export class AddApplicationDocumentDto extends ApplicantVerificationDto {
  @ApiProperty({ enum: ApplicationDocumentType })
  @IsEnum(ApplicationDocumentType)
  type!: ApplicationDocumentType;

  @ApiProperty({ example: 'national-id.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsMimeType()
  mimeType!: string;

  @ApiProperty({ example: 245678, description: 'File size in bytes' })
  @IsInt()
  @Min(1)
  @Max(MAX_FILE_SIZE_BYTES)
  fileSize!: number;
}
