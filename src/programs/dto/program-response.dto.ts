import { ApiProperty } from '@nestjs/swagger';

export class ProgramResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9i0j1' })
  id!: string;

  @ApiProperty({ example: 'Video Production' })
  name!: string;

  @ApiProperty({ example: 'video-production' })
  slug!: string;

  @ApiProperty({ example: 'VID' })
  code!: string;

  @ApiProperty({
    example:
      'Practical training covering video production, television production, editing, photography, lighting, cinematography and related creative production skills.',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ example: 1, nullable: true })
  displayOrder!: number | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-08-20T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-20T12:00:00.000Z' })
  updatedAt!: Date;
}
