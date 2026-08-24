import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

interface ProgramResponseBody {
  slug: string;
  name: string;
  code: string;
  isActive: boolean;
}

// Official SKAFF Academy catalog order — must never be reshuffled or
// silently replaced with invented programs.
const EXPECTED_SLUGS_IN_ORDER = [
  'video-production',
  'audio-production',
  'full-stack-development',
  'backend-development',
  'frontend-development',
  'ui-ux-design',
  'power-of-ai',
  'digital-marketing-social-media-management',
];

describe('Programs (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/programs returns all 8 official programs in display order', async () => {
    const response = await request(server).get('/api/v1/programs').expect(200);
    const programs = response.body as ProgramResponseBody[];

    expect(Array.isArray(programs)).toBe(true);
    expect(programs).toHaveLength(8);
    expect(programs.map((program) => program.slug)).toEqual(EXPECTED_SLUGS_IN_ORDER);
    expect(programs.every((program) => program.isActive === true)).toBe(true);
  });

  it('GET /api/v1/programs/:slug returns the matching active program', async () => {
    const response = await request(server).get('/api/v1/programs/video-production').expect(200);

    expect(response.body).toMatchObject({
      slug: 'video-production',
      name: 'Video Production',
      code: 'VID',
      isActive: true,
    });
  });

  it('GET /api/v1/programs/:slug returns 404 for an unknown slug', async () => {
    const response = await request(server).get('/api/v1/programs/does-not-exist').expect(404);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: 404,
      path: '/api/v1/programs/does-not-exist',
    });
  });
});
