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
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AddApplicationDocumentDto } from './dto/add-application-document.dto';
import { ApplicantApplicationViewDto } from './dto/applicant-application-view.dto';
import { ApplicantVerificationDto } from './dto/applicant-verification.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { ApplicationsService } from './applications.service';

@ApiTags('Applications')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @ApiOperation({ summary: 'Start a new application (status: DRAFT). No account required.' })
  @ApiCreatedResponse({ type: ApplicantApplicationViewDto })
  async create(@Body() dto: CreateApplicationDto): Promise<ApplicantApplicationViewDto> {
    return this.applicationsService.create(dto);
  }

  @Patch(':reference')
  @ApiOperation({ summary: 'Update a DRAFT or MORE_INFORMATION_REQUIRED application' })
  @ApiOkResponse({ type: ApplicantApplicationViewDto })
  async update(
    @Param('reference') reference: string,
    @Body() dto: UpdateApplicationDto,
  ): Promise<ApplicantApplicationViewDto> {
    return this.applicationsService.update(reference, dto);
  }

  @Post(':reference/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a DRAFT application for review' })
  @ApiOkResponse({ type: ApplicantApplicationViewDto })
  async submit(
    @Param('reference') reference: string,
    @Body() dto: ApplicantVerificationDto,
  ): Promise<ApplicantApplicationViewDto> {
    return this.applicationsService.submit(reference, dto);
  }

  @Get(':reference/status')
  @ApiOperation({
    summary: 'Check application status',
    description:
      'Requires `verificationEmail` — the email address used when the application was created.',
  })
  @ApiOkResponse({ type: ApplicantApplicationViewDto })
  async status(
    @Param('reference') reference: string,
    @Query() query: ApplicantVerificationDto,
  ): Promise<ApplicantApplicationViewDto> {
    const application = await this.applicationsService.findVerifiedApplication(
      reference,
      query.verificationEmail,
    );
    return this.applicationsService.mapToView(application);
  }

  @Post(':reference/resubmit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resubmit after MORE_INFORMATION_REQUIRED' })
  @ApiOkResponse({ type: ApplicantApplicationViewDto })
  async resubmit(
    @Param('reference') reference: string,
    @Body() dto: ApplicantVerificationDto,
  ): Promise<ApplicantApplicationViewDto> {
    return this.applicationsService.resubmit(reference, dto);
  }

  @Post(':reference/documents')
  @ApiOperation({ summary: 'Attach document metadata (no file storage in this phase)' })
  @ApiOkResponse({ type: ApplicantApplicationViewDto })
  async addDocument(
    @Param('reference') reference: string,
    @Body() dto: AddApplicationDocumentDto,
  ): Promise<ApplicantApplicationViewDto> {
    return this.applicationsService.addDocument(reference, dto);
  }
}
