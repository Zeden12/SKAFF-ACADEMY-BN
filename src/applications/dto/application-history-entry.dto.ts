import { ApiProperty } from '@nestjs/swagger';
import { ApplicationHistoryActorType, ApplicationHistoryVisibility } from '@prisma/client';

export class ApplicationHistoryEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty({ enum: ApplicationHistoryActorType })
  actorType!: ApplicationHistoryActorType;

  @ApiProperty({ nullable: true })
  actorName!: string | null;

  @ApiProperty({ nullable: true })
  message!: string | null;

  @ApiProperty({ enum: ApplicationHistoryVisibility })
  visibility!: ApplicationHistoryVisibility;

  @ApiProperty()
  createdAt!: Date;
}
