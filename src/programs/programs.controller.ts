import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Program } from '@prisma/client';

import { CurrentIntakeResponseDto } from '../intakes/dto/current-intake-response.dto';
import { IntakesService } from '../intakes/intakes.service';
import { ProgramResponseDto } from './dto/program-response.dto';
import { ProgramsService } from './programs.service';

@ApiTags('Programs')
@Controller('programs')
export class ProgramsController {
  constructor(
    private readonly programsService: ProgramsService,
    private readonly intakesService: IntakesService,
  ) {}

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

  @Get(':slug/intakes/current')
  @ApiOperation({
    summary: 'Get the current application-eligible intake for a program, if any',
    description:
      'Always returns 200. `available: false` (with a display-ready `message`) means there is ' +
      'currently no open intake for this program — the frontend Apply button can stay visible ' +
      'and show this message instead of erroring.',
  })
  @ApiParam({ name: 'slug', example: 'video-production' })
  @ApiOkResponse({ type: CurrentIntakeResponseDto })
  async currentIntake(@Param('slug') slug: string): Promise<CurrentIntakeResponseDto> {
    const program = await this.programsService.findActiveBySlug(slug);
    return this.intakesService.findCurrentEligibleForProgram(program.id);
  }
}
