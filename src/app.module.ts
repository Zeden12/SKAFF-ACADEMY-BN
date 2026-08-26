import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ApplicationsModule } from './applications/applications.module';
import { AuthModule } from './auth/auth.module';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { IntakesModule } from './intakes/intakes.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProgramsModule } from './programs/programs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    ProgramsModule,
    AuthModule,
    IntakesModule,
    ApplicationsModule,
  ],
})
export class AppModule {}
