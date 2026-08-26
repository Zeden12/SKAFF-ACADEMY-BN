import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserType } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserTypesGuard } from '../auth/guards/user-types.guard';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AdminApplicationsService } from './admin-applications.service';
import { AdminApplicationDetailDto } from './dto/admin-application-detail.dto';
import { AdminApplicationListResponseDto } from './dto/admin-application-list-response.dto';
import { AdminApplicationQueryDto } from './dto/admin-application-query.dto';
import { EnrollApplicationDto } from './dto/enroll-application.dto';
import { EnrollmentResultDto } from './dto/enrollment-result.dto';
import { InternalNotesDto } from './dto/internal-notes.dto';
import { RejectApplicationDto } from './dto/reject-application.dto';
import { RequestInformationDto } from './dto/request-information.dto';
import { EnrollmentConversionService } from './enrollment-conversion.service';

function actorNameOf(user: AuthenticatedUser): string {
  return user.staffProfile?.fullName ?? user.email;
}

@ApiTags('Admin — Applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserTypesGuard)
@UserTypes(UserType.STAFF)
@Controller('admin/applications')
export class AdminApplicationsController {
  constructor(
    private readonly adminApplicationsService: AdminApplicationsService,
    private readonly enrollmentConversionService: EnrollmentConversionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List/search applications (STAFF only)' })
  @ApiOkResponse({ type: AdminApplicationListResponseDto })
  async list(@Query() query: AdminApplicationQueryDto): Promise<AdminApplicationListResponseDto> {
    return this.adminApplicationsService.list(query);
  }

  @Get(':reference')
  @ApiOperation({
    summary:
      'Full application detail — internal notes, full history, enrollment readiness (STAFF only)',
  })
  @ApiOkResponse({ type: AdminApplicationDetailDto })
  async detail(@Param('reference') reference: string): Promise<AdminApplicationDetailDto> {
    return this.adminApplicationsService.detail(reference);
  }

  @Patch(':reference/under-review')
  @ApiOperation({ summary: 'SUBMITTED → UNDER_REVIEW (STAFF only)' })
  @ApiOkResponse({ type: AdminApplicationDetailDto })
  async setUnderReview(
    @Param('reference') reference: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminApplicationDetailDto> {
    return this.adminApplicationsService.setUnderReview(reference, actorNameOf(user));
  }

  @Post(':reference/request-information')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'UNDER_REVIEW → MORE_INFORMATION_REQUIRED, with an applicant-facing message (STAFF only)',
  })
  @ApiOkResponse({ type: AdminApplicationDetailDto })
  async requestInformation(
    @Param('reference') reference: string,
    @Body() dto: RequestInformationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminApplicationDetailDto> {
    return this.adminApplicationsService.requestInformation(reference, dto, actorNameOf(user));
  }

  @Post(':reference/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'UNDER_REVIEW → APPROVED (STAFF only). Does NOT create a student — see /enroll.',
  })
  @ApiOkResponse({ type: AdminApplicationDetailDto })
  async approve(
    @Param('reference') reference: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminApplicationDetailDto> {
    return this.adminApplicationsService.approve(reference, actorNameOf(user));
  }

  @Post(':reference/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'UNDER_REVIEW → REJECTED, with an applicant-facing message (STAFF only)',
  })
  @ApiOkResponse({ type: AdminApplicationDetailDto })
  async reject(
    @Param('reference') reference: string,
    @Body() dto: RejectApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminApplicationDetailDto> {
    return this.adminApplicationsService.reject(reference, dto, actorNameOf(user));
  }

  @Patch(':reference/internal-notes')
  @ApiOperation({
    summary: 'Replace internal admin notes — never shown to the applicant (STAFF only)',
  })
  @ApiOkResponse({ type: AdminApplicationDetailDto })
  async updateInternalNotes(
    @Param('reference') reference: string,
    @Body() dto: InternalNotesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminApplicationDetailDto> {
    return this.adminApplicationsService.updateInternalNotes(reference, dto, actorNameOf(user));
  }

  @Post(':reference/enroll')
  @ApiOperation({
    summary: 'APPROVED → ENROLLED: create/resolve User + StudentProfile + Enrollment (STAFF only)',
    description:
      'Only APPROVED applications may be enrolled. Creates the student account in an inactive (not-yet-login-capable) ' +
      'state — see EnrollmentResultDto.user.isActive. Idempotency: an application already linked to an Enrollment ' +
      'cannot be converted again.',
  })
  @ApiOkResponse({ type: EnrollmentResultDto })
  async enroll(
    @Param('reference') reference: string,
    @Body() dto: EnrollApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EnrollmentResultDto> {
    return this.enrollmentConversionService.enroll(reference, dto, actorNameOf(user));
  }
}
