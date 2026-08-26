import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

interface LoginResponseBody {
  accessToken: string;
}

interface IntakeBody {
  id: string;
  name: string;
  applicationsOpen: boolean;
}

interface CurrentIntakeBody {
  available: boolean;
  intake: IntakeBody | null;
  message: string | null;
}

const STAFF_EMAIL = 'trainer@skaffacademy.local';
const STUDENT_EMAIL = 'student@skaffacademy.local';
const DEV_PASSWORD = 'SkaffDev2026!';

describe('Intakes (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let staffToken: string;
  let studentToken: string;
  let createdIntakeIdForCleanup: string | undefined;

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
    prisma = app.get(PrismaService);

    const staffLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: STAFF_EMAIL, password: DEV_PASSWORD })
      .expect(200);
    staffToken = (staffLogin.body as LoginResponseBody).accessToken;

    const studentLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: STUDENT_EMAIL, password: DEV_PASSWORD })
      .expect(200);
    studentToken = (studentLogin.body as LoginResponseBody).accessToken;
  });

  afterAll(async () => {
    // No delete endpoint exists (intentionally — see IntakesService), so the
    // one test-created intake is cleaned up directly to keep the dev DB tidy.
    if (createdIntakeIdForCleanup) {
      await prisma.intake.delete({ where: { id: createdIntakeIdForCleanup } });
    }
    await app.close();
  });

  describe('GET /api/v1/programs/:slug/intakes/current', () => {
    it('returns the seeded open intake for full-stack-development', async () => {
      const response = await request(server)
        .get('/api/v1/programs/full-stack-development/intakes/current')
        .expect(200);
      const body = response.body as CurrentIntakeBody;

      expect(body.available).toBe(true);
      expect(body.intake?.applicationsOpen).toBe(true);
    });

    it('returns available: false with a display message for a program with no open intake', async () => {
      const response = await request(server)
        .get('/api/v1/programs/video-production/intakes/current')
        .expect(200);
      const body = response.body as CurrentIntakeBody;

      expect(body).toMatchObject({
        available: false,
        intake: null,
        message: 'Applications are currently closed for this program.',
      });
    });

    it('returns 404 for an unknown program slug', async () => {
      await request(server).get('/api/v1/programs/does-not-exist/intakes/current').expect(404);
    });
  });

  describe('Admin intake management', () => {
    let programId: string;
    let createdIntakeId: string;

    beforeAll(async () => {
      const program = await request(server).get('/api/v1/programs/backend-development').expect(200);
      programId = (program.body as { id: string }).id;
    });

    it('rejects an unauthenticated request', async () => {
      await request(server).get('/api/v1/admin/intakes').expect(401);
    });

    it('rejects a STUDENT token', async () => {
      await request(server)
        .get('/api/v1/admin/intakes')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });

    it('allows STAFF to create an intake', async () => {
      const response = await request(server)
        .post('/api/v1/admin/intakes')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ programId, name: 'Backend Development 2027 Intake (test)' })
        .expect(201);
      const body = response.body as IntakeBody;

      expect(body.name).toBe('Backend Development 2027 Intake (test)');
      expect(body.applicationsOpen).toBe(false);
      createdIntakeId = body.id;
      createdIntakeIdForCleanup = body.id;
    });

    it('allows STAFF to update the intake', async () => {
      const response = await request(server)
        .patch(`/api/v1/admin/intakes/${createdIntakeId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Backend Development 2027 Intake (renamed)' })
        .expect(200);

      expect((response.body as IntakeBody).name).toBe('Backend Development 2027 Intake (renamed)');
    });

    it('allows STAFF to open then close applications', async () => {
      const opened = await request(server)
        .patch(`/api/v1/admin/intakes/${createdIntakeId}/applications/open`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      expect((opened.body as IntakeBody).applicationsOpen).toBe(true);

      const closed = await request(server)
        .patch(`/api/v1/admin/intakes/${createdIntakeId}/applications/close`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      expect((closed.body as IntakeBody).applicationsOpen).toBe(false);
    });

    it('rejects an invalid applicationCloseAt before applicationOpenAt', async () => {
      await request(server)
        .patch(`/api/v1/admin/intakes/${createdIntakeId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          applicationOpenAt: '2027-02-01T00:00:00.000Z',
          applicationCloseAt: '2027-01-01T00:00:00.000Z',
        })
        .expect(400);
    });
  });
});
