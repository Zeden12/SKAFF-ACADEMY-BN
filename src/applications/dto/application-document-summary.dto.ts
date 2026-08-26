import { ApiProperty } from '@nestjs/swagger';
import { ApplicationDocumentType } from '@prisma/client';

export class ApplicationDocumentSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ApplicationDocumentType })
  type!: ApplicationDocumentType;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  fileSize!: number;

  @ApiProperty()
  createdAt!: Date;
}
