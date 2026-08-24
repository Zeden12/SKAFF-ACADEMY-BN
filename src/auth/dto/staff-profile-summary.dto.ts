import { ApiProperty } from '@nestjs/swagger';
import { StaffStatus } from '@prisma/client';

export class StaffProfileSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ enum: StaffStatus })
  status!: StaffStatus;
}
