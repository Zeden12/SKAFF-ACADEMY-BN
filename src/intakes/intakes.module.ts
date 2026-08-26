import { Module } from '@nestjs/common';

import { AdminIntakesController } from './admin-intakes.controller';
import { IntakesService } from './intakes.service';

@Module({
  controllers: [AdminIntakesController],
  providers: [IntakesService],
  exports: [IntakesService],
})
export class IntakesModule {}
