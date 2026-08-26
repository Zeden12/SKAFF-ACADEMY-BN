import { ApiProperty } from '@nestjs/swagger';
import { EnrollmentStatus } from '@prisma/client';

export class EnrolledUserSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({
    description:
      'False for a newly created account: login is not yet activated because there is no email/password-setup flow in this phase.',
  })
  isActive!: boolean;
}

export class EnrolledStudentSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'SKF-2026-0002' })
  studentNumber!: string;

  @ApiProperty()
  fullName!: string;
}

export class EnrollmentSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: EnrollmentStatus })
  status!: EnrollmentStatus;

  @ApiProperty()
  programId!: string;

  @ApiProperty()
  intakeId!: string;

  @ApiProperty({ nullable: true })
  classGroupId!: string | null;
}

export class EnrollmentResultDto {
  @ApiProperty({ example: 'SKA-APP-2026-0001' })
  applicationReference!: string;

  @ApiProperty({ type: EnrolledUserSummaryDto })
  user!: EnrolledUserSummaryDto;

  @ApiProperty({ type: EnrolledStudentSummaryDto })
  student!: EnrolledStudentSummaryDto;

  @ApiProperty({ type: EnrollmentSummaryDto })
  enrollment!: EnrollmentSummaryDto;
}
