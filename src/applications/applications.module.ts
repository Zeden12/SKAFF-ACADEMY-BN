import { Module } from '@nestjs/common';

import { ProgramsModule } from '../programs/programs.module';
import { AdminApplicationsController } from './admin-applications.controller';
import { AdminApplicationsService } from './admin-applications.service';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { EnrollmentConversionService } from './enrollment-conversion.service';

@Module({
  imports: [ProgramsModule],
  controllers: [ApplicationsController, AdminApplicationsController],
  providers: [ApplicationsService, AdminApplicationsService, EnrollmentConversionService],
})
export class ApplicationsModule {}
