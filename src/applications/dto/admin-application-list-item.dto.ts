import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';

export class AdminApplicationListItemDto {
  @ApiProperty()
  reference!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: ApplicationStatus })
  status!: ApplicationStatus;

  @ApiProperty()
  programId!: string;

  @ApiProperty()
  programName!: string;

  @ApiProperty()
  intakeId!: string;

  @ApiProperty()
  intakeName!: string;

  @ApiProperty({ nullable: true })
  submittedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}
