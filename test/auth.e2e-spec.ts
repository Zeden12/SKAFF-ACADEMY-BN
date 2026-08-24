import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserType } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

interface LoginResponseBody {
  accessToken: string;
  user: {
    email: string;
    userType: string;
    isActive: boolean;
    studentProfile: { fullName: string } | null;
    staffProfile: { fullName: string } | null;
  };
}

interface ErrorResponseBody {
  message: string;
}

interface MeResponseBody {
  email: string;
  userType: string;
}

const DEV_PASSWORD = 'SkaffDev2026!';
const STUDENT_EMAIL = 'student@skaffacademy.local';
const STAFF_EMAIL = 'trainer@skaffacademy.local';
const INACTIVE_EMAIL = 'inactive-e2e-test@skaffacademy.local';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

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

    // Temporary account used only to exercise the "inactive user" rule;
    // removed again in afterAll so it never lingers in the dev database.
    await prisma.user.create({
      data: {
        email: INACTIVE_EMAIL,
        passwordHash: await argon2.hash(DEV_PASSWORD),
        userType: UserType.STUDENT,
        isActive: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { email: INACTIVE_EMAIL } });
    await app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in a valid student and returns an accessToken and studentProfile summary', async () => {
      const response = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: STUDENT_EMAIL, password: DEV_PASSWORD })
        .expect(200);
      const body = response.body as LoginResponseBody;

      expect(typeof body.accessToken).toBe('string');
      expect(body.user).toMatchObject({
        email: STUDENT_EMAIL,
        userType: 'STUDENT',
        isActive: true,
      });
      expect(body.user.studentProfile).toMatchObject({ fullName: 'Aline Uwimana' });
      expect(body.user.staffProfile).toBeNull();
      expect(body.user).not.toHaveProperty('passwordHash');
    });

    it('logs in a valid staff member and returns an accessToken and staffProfile summary', async () => {
      const response = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: STAFF_EMAIL, password: DEV_PASSWORD })
        .expect(200);
      const body = response.body as LoginResponseBody;

      expect(typeof body.accessToken).toBe('string');
      expect(body.user).toMatchObject({ email: STAFF_EMAIL, userType: 'STAFF' });
      expect(body.user.staffProfile).toMatchObject({ fullName: 'SKAFF Academy Trainer' });
      expect(body.user.studentProfile).toBeNull();
      expect(body.user).not.toHaveProperty('passwordHash');
    });

    it('rejects a wrong password with a generic message', async () => {
      const response = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: STUDENT_EMAIL, password: 'WrongPassword!' })
        .expect(401);

      expect((response.body as ErrorResponseBody).message).toBe('Invalid email or password');
    });

    it('rejects an unknown email with the same generic message', async () => {
      const response = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@skaffacademy.local', password: DEV_PASSWORD })
        .expect(401);

      expect((response.body as ErrorResponseBody).message).toBe('Invalid email or password');
    });

    it('rejects an inactive account with the same generic message', async () => {
      const response = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: INACTIVE_EMAIL, password: DEV_PASSWORD })
        .expect(401);

      expect((response.body as ErrorResponseBody).message).toBe('Invalid email or password');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('rejects a request without a token', async () => {
      await request(server).get('/api/v1/auth/me').expect(401);
    });

    it('rejects a request with a garbage token', async () => {
      await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('returns the current user for a valid token', async () => {
      const login = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: STUDENT_EMAIL, password: DEV_PASSWORD })
        .expect(200);
      const { accessToken } = login.body as LoginResponseBody;

      const response = await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const body = response.body as MeResponseBody;

      expect(body).toMatchObject({ email: STUDENT_EMAIL, userType: 'STUDENT' });
      expect(body).not.toHaveProperty('passwordHash');
    });
  });

  describe('GET /api/v1/auth/staff-only (UserTypes guard)', () => {
    async function loginAndGetToken(email: string): Promise<string> {
      const login = await request(server)
        .post('/api/v1/auth/login')
        .send({ email, password: DEV_PASSWORD })
        .expect(200);

      return (login.body as LoginResponseBody).accessToken;
    }

    it('allows an authenticated STAFF account', async () => {
      const token = await loginAndGetToken(STAFF_EMAIL);

      await request(server)
        .get('/api/v1/auth/staff-only')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('rejects an authenticated STUDENT account with 403', async () => {
      const token = await loginAndGetToken(STUDENT_EMAIL);

      await request(server)
        .get('/api/v1/auth/staff-only')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(server).get('/api/v1/auth/staff-only').expect(401);
    });
  });
});
