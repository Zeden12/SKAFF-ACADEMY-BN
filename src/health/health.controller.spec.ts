import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ConfigService,
          useValue: { get: () => 'test' },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('reports ok status with a timestamp and environment', () => {
    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(result.environment).toBe('test');
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
  });
});
