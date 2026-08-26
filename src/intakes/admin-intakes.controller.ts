import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Intake, UserType } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { AdminIntakeQueryDto } from './dto/admin-intake-query.dto';
import { CreateIntakeDto } from './dto/create-intake.dto';
import { IntakeResponseDto } from './dto/intake-response.dto';
import { UpdateIntakeDto } from './dto/update-intake.dto';
import { IntakesService } from './intakes.service';

@ApiTags('Admin — Intakes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserTypesGuard)
@UserTypes(UserType.STAFF)
@Controller('admin/intakes')
export class AdminIntakesController {
  constructor(private readonly intakesService: IntakesService) {}

  @Get()
  @ApiOperation({ summary: 'List intakes (STAFF only)' })
  @ApiOkResponse({ type: IntakeResponseDto, isArray: true })
  async list(@Query() query: AdminIntakeQueryDto): Promise<Intake[]> {
    return this.intakesService.adminList(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create an intake (STAFF only)' })
  @ApiOkResponse({ type: IntakeResponseDto })
  async create(@Body() dto: CreateIntakeDto): Promise<Intake> {
    return this.intakesService.adminCreate(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an intake by id (STAFF only)' })
  @ApiOkResponse({ type: IntakeResponseDto })
  async findOne(@Param('id') id: string): Promise<Intake> {
    return this.intakesService.adminFindOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an intake (STAFF only)' })
  @ApiOkResponse({ type: IntakeResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateIntakeDto): Promise<Intake> {
    return this.intakesService.adminUpdate(id, dto);
  }

  @Patch(':id/applications/open')
  @ApiOperation({ summary: 'Open applications for this intake (STAFF only)' })
  @ApiOkResponse({ type: IntakeResponseDto })
  async openApplications(@Param('id') id: string): Promise<Intake> {
    return this.intakesService.setApplicationsOpen(id, true);
  }

  @Patch(':id/applications/close')
  @ApiOperation({ summary: 'Close applications for this intake (STAFF only)' })
  @ApiOkResponse({ type: IntakeResponseDto })
  async closeApplications(@Param('id') id: string): Promise<Intake> {
    return this.intakesService.setApplicationsOpen(id, false);
  }
}
