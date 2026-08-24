import { ApiProperty } from '@nestjs/swagger';
import { UserType } from '@prisma/client';

import { StaffProfileSummaryDto } from './staff-profile-summary.dto';
import { StudentProfileSummaryDto } from './student-profile-summary.dto';

export class UserSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserType })
  userType!: UserType;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: StudentProfileSummaryDto, nullable: true })
  studentProfile!: StudentProfileSummaryDto | null;

  @ApiProperty({ type: StaffProfileSummaryDto, nullable: true })
  staffProfile!: StaffProfileSummaryDto | null;
}
