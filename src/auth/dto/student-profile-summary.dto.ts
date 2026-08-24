import { ApiProperty } from '@nestjs/swagger';
import { StudentStatus } from '@prisma/client';

export class StudentProfileSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  studentNumber!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ enum: StudentStatus })
  status!: StudentStatus;
}
