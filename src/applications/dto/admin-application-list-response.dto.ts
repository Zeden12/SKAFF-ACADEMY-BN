import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';

import { AdminApplicationListItemDto } from './admin-application-list-item.dto';

export class ApplicationStatusCountsDto implements Record<ApplicationStatus, number> {
  @ApiProperty() DRAFT!: number;
  @ApiProperty() SUBMITTED!: number;
  @ApiProperty() UNDER_REVIEW!: number;
  @ApiProperty() MORE_INFORMATION_REQUIRED!: number;
  @ApiProperty() APPROVED!: number;
  @ApiProperty() REJECTED!: number;
  @ApiProperty() ENROLLED!: number;
}

export class AdminApplicationListResponseDto {
  @ApiProperty({ type: AdminApplicationListItemDto, isArray: true })
  items!: AdminApplicationListItemDto[];

  @ApiProperty() page!: number;

  @ApiProperty() pageSize!: number;

  @ApiProperty({
    description: 'Total applications matching the current filters (ignoring pagination)',
  })
  total!: number;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty({
    type: ApplicationStatusCountsDto,
    description:
      'Counts by status across ALL applications matching the current filters, for the admin dashboard',
  })
  counts!: ApplicationStatusCountsDto;
}
