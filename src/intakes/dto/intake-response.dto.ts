import { ApiProperty } from '@nestjs/swagger';
import { IntakeStatus } from '@prisma/client';

export class IntakeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  programId!: string;

  @ApiProperty({ enum: IntakeStatus })
  status!: IntakeStatus;

  @ApiProperty()
  applicationsOpen!: boolean;

  @ApiProperty({ nullable: true })
  applicationOpenAt!: Date | null;

  @ApiProperty({ nullable: true })
  applicationCloseAt!: Date | null;

  @ApiProperty({ nullable: true })
  capacity!: number | null;

  @ApiProperty({ nullable: true })
  startDate!: Date | null;

  @ApiProperty({ nullable: true })
  endDate!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
