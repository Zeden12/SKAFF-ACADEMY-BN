import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Program } from '@prisma/client';

import { ProgramResponseDto } from './dto/program-response.dto';
import { ProgramsService } from './programs.service';

@ApiTags('Programs')
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  @ApiOperation({ summary: 'List active programs in official display order' })
  @ApiOkResponse({ type: ProgramResponseDto, isArray: true })
  async findAll(): Promise<Program[]> {
    return this.programsService.findAllActive();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a single active program by slug' })
  @ApiParam({ name: 'slug', example: 'video-production' })
  @ApiOkResponse({ type: ProgramResponseDto })
  async findOne(@Param('slug') slug: string): Promise<Program> {
    return this.programsService.findActiveBySlug(slug);
  }
}
