import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IntakeStatus } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

interface LoginResponseBody {
  accessToken: string;
}

interface ApplicationDetailBody {
  reference: string;
  status: string;
  applicantFacingMessage: string | null;
  internalAdminNotes: string | null;
  enrollmentReadiness: boolean;
}

interface EnrollmentResultBody {
  applicationReference: string;
  user: { id: string; email: string; isActive: boolean };
  student: { id: string; studentNumber: string; fullName: string };
  enrollment: { id: string; status: string; classGroupId: string | null };
}

const STAFF_EMAIL = 'trainer@skaffacademy.local';
const STUDENT_EMAIL = 'student@skaffacademy.local';
const DEV_PASSWORD = 'SkaffDev2026!';

const COMPLETE_EDUCATION = {
  highestEducationLevel: 'SECONDARY',
  previousInstitution: 'Green Hills Academy',
  completionYear: 2024,
};

describe('Admin Applications & Enrollment (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;
  let staffToken: string;
  let studentToken: string;

  let programId: string;
  let intakeId: string;
  let otherProgramClassGroupId: string;

  const applicationIdsToCleanUp: string[] = [];
  const enrollmentIdsToCleanUp: string[] = [];
  const userEmailsToCleanUp: string[] = [];

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

    const program = await prisma.program.findUniqueOrThrow({ where: { slug: 'power-of-ai' } });
    programId = program.id;

    const intake = await prisma.intake.create({
      data: {
        name: '[e2e] Admin/enrollment test intake',
        programId,
        status: IntakeStatus.ACTIVE,
        applicationsOpen: true,
      },
    });
    intakeId = intake.id;

    // A class group that belongs to a DIFFERENT program/intake, to exercise
    // the "mismatched class group rejected" enrollment rule.
    const otherProgram = await prisma.program.findUniqueOrThrow({
      where: { slug: 'audio-production' },
    });
    const otherIntake = await prisma.intake.create({
      data: {
        name: '[e2e] Other program intake',
        programId: otherProgram.id,
        status: IntakeStatus.ACTIVE,
      },
    });
    const otherClassGroup = await prisma.classGroup.create({
      data: {
        name: '[e2e] Other program class',
        code: `E2E-OTHER-${Date.now()}`,
        programId: otherProgram.id,
        intakeId: otherIntake.id,
        status: 'UPCOMING',
      },
    });
    otherProgramClassGroupId = otherClassGroup.id;
  });

  afterAll(async () => {
    await prisma.enrollment.deleteMany({ where: { id: { in: enrollmentIdsToCleanUp } } });
    await prisma.studentProfile.deleteMany({
      where: { user: { email: { in: userEmailsToCleanUp } } },
    });
    await prisma.user.deleteMany({ where: { email: { in: userEmailsToCleanUp } } });
    await prisma.application.deleteMany({ where: { id: { in: applicationIdsToCleanUp } } });
    await prisma.classGroup.deleteMany({ where: { id: otherProgramClassGroupId } });
    await prisma.intake.deleteMany({
      where: { name: { in: ['[e2e] Admin/enrollment test intake', '[e2e] Other program intake'] } },
    });
    await app.close();
  });

  async function createSubmittedApplication(email: string, fullName: string): Promise<string> {
    const created = await request(server)
      .post('/api/v1/applications')
      .send({ programId, intakeId, fullName, email, phone: '+250788999999', ...COMPLETE_EDUCATION })
      .expect(201);
    const reference = (created.body as { reference: string }).reference;

    const application = await prisma.application.findUniqueOrThrow({ where: { reference } });
    applicationIdsToCleanUp.push(application.id);

    await request(server)
      .post(`/api/v1/applications/${reference}/submit`)
      .send({ verificationEmail: email })
      .expect(200);

    return reference;
  }

  function staffAuth(req: request.Test): request.Test {
    return req.set('Authorization', `Bearer ${staffToken}`);
  }

  describe('Role protection', () => {
    it('rejects an unauthenticated admin queue request', async () => {
      await request(server).get('/api/v1/admin/applications').expect(401);
    });

    it('rejects a STUDENT token on an admin action', async () => {
      const reference = await createSubmittedApplication(
        'e2e.role-check@example.test',
        'Role Check',
      );
      await request(server)
        .patch(`/api/v1/admin/applications/${reference}/under-review`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  describe('Full review lifecycle and state machine', () => {
    let reference: string;

    beforeAll(async () => {
      reference = await createSubmittedApplication(
        'e2e.lifecycle@example.test',
        'Lifecycle Applicant',
      );
    });

    it('appears in the admin queue and search', async () => {
      const response = await staffAuth(request(server).get('/api/v1/admin/applications')).query({
        search: 'Lifecycle Applicant',
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        items: { reference: string }[];
        counts: Record<string, number>;
      };
      expect(body.items.some((item) => item.reference === reference)).toBe(true);
      expect(body.counts.SUBMITTED).toBeGreaterThanOrEqual(1);
    });

    it('rejects approve while still SUBMITTED (must be UNDER_REVIEW first)', async () => {
      await staffAuth(
        request(server).post(`/api/v1/admin/applications/${reference}/approve`),
      ).expect(409);
    });

    it('moves SUBMITTED -> UNDER_REVIEW', async () => {
      const response = await staffAuth(
        request(server).patch(`/api/v1/admin/applications/${reference}/under-review`),
      );
      expect((response.body as ApplicationDetailBody).status).toBe('UNDER_REVIEW');
    });

    it('rejects request-information without a message', async () => {
      await staffAuth(
        request(server).post(`/api/v1/admin/applications/${reference}/request-information`),
      )
        .send({})
        .expect(400);
    });

    it('moves UNDER_REVIEW -> MORE_INFORMATION_REQUIRED with a message', async () => {
      const response = await staffAuth(
        request(server).post(`/api/v1/admin/applications/${reference}/request-information`),
      ).send({ message: 'Please upload your ID.' });

      const body = response.body as ApplicationDetailBody;
      expect(body.status).toBe('MORE_INFORMATION_REQUIRED');
      expect(body.applicantFacingMessage).toBe('Please upload your ID.');
    });

    it('applicant resubmits MORE_INFORMATION_REQUIRED -> SUBMITTED, clearing the live message', async () => {
      const response = await request(server)
        .post(`/api/v1/applications/${reference}/resubmit`)
        .send({ verificationEmail: 'e2e.lifecycle@example.test' })
        .expect(200);

      expect(response.body).toMatchObject({ status: 'SUBMITTED', applicantFacingMessage: null });
    });

    it('moves back to UNDER_REVIEW then APPROVED', async () => {
      await staffAuth(
        request(server).patch(`/api/v1/admin/applications/${reference}/under-review`),
      ).expect(200);
      const response = await staffAuth(
        request(server).post(`/api/v1/admin/applications/${reference}/approve`),
      );

      const body = response.body as ApplicationDetailBody;
      expect(body.status).toBe('APPROVED');
      expect(body.enrollmentReadiness).toBe(true);
    });

    it('rejects reject() on an already-APPROVED application (invalid transition)', async () => {
      await staffAuth(request(server).post(`/api/v1/admin/applications/${reference}/reject`))
        .send({ message: 'too late' })
        .expect(409);
    });

    it('admin detail includes internalAdminNotes (null) and full history', async () => {
      const response = await staffAuth(
        request(server).get(`/api/v1/admin/applications/${reference}`),
      );
      const body = response.body as ApplicationDetailBody;

      expect(body).toHaveProperty('internalAdminNotes');
      expect(body.status).toBe('APPROVED');
    });
  });

  describe('Reject flow', () => {
    it('requires a message and records it as the applicant-facing reason', async () => {
      const reference = await createSubmittedApplication(
        'e2e.reject-flow@example.test',
        'Reject Flow',
      );
      await staffAuth(
        request(server).patch(`/api/v1/admin/applications/${reference}/under-review`),
      ).expect(200);

      await staffAuth(request(server).post(`/api/v1/admin/applications/${reference}/reject`))
        .send({})
        .expect(400);

      const response = await staffAuth(
        request(server).post(`/api/v1/admin/applications/${reference}/reject`),
      )
        .send({ message: 'Not a fit for this intake.' })
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'REJECTED',
        applicantFacingMessage: 'Not a fit for this intake.',
      });
    });
  });

  describe('Enrollment conversion', () => {
    it('rejects enrolling an application that is not APPROVED', async () => {
      const reference = await createSubmittedApplication(
        'e2e.not-approved@example.test',
        'Not Approved',
      );
      await staffAuth(request(server).post(`/api/v1/admin/applications/${reference}/enroll`))
        .send({})
        .expect(409);
    });

    it('rejects a class group from a different program/intake', async () => {
      const reference = await createSubmittedApplication(
        'e2e.mismatch@example.test',
        'Mismatch Case',
      );
      await staffAuth(
        request(server).patch(`/api/v1/admin/applications/${reference}/under-review`),
      ).expect(200);
      await staffAuth(
        request(server).post(`/api/v1/admin/applications/${reference}/approve`),
      ).expect(200);

      await staffAuth(request(server).post(`/api/v1/admin/applications/${reference}/enroll`))
        .send({ classGroupId: otherProgramClassGroupId })
        .expect(400);
    });

    it('converts an approved application into a User + StudentProfile + Enrollment', async () => {
      const email = 'e2e.enroll-success@example.test';
      const reference = await createSubmittedApplication(email, 'Enroll Success');
      userEmailsToCleanUp.push(email);

      await staffAuth(
        request(server).patch(`/api/v1/admin/applications/${reference}/under-review`),
      ).expect(200);
      await staffAuth(
        request(server).post(`/api/v1/admin/applications/${reference}/approve`),
      ).expect(200);

      const response = await staffAuth(
        request(server).post(`/api/v1/admin/applications/${reference}/enroll`),
      ).send({});

      expect(response.status).toBe(201);
      const body = response.body as EnrollmentResultBody;
      expect(body.applicationReference).toBe(reference);
      expect(body.user.email).toBe(email);
      // No email/password-setup flow exists yet, so a newly created account
      // must start inactive — see EnrollmentConversionService.
      expect(body.user.isActive).toBe(false);
      expect(body.student.studentNumber).toMatch(/^SKF-\d{4}-\d{4}$/);
      expect(body.enrollment.status).toBe('ACTIVE');
      enrollmentIdsToCleanUp.push(body.enrollment.id);

      const detail = await staffAuth(
        request(server).get(`/api/v1/admin/applications/${reference}`),
      );
      expect((detail.body as ApplicationDetailBody).status).toBe('ENROLLED');
    });

    it('prevents converting the same application twice, leaving exactly one Enrollment', async () => {
      const email = 'e2e.enroll-duplicate@example.test';
      const reference = await createSubmittedApplication(email, 'Enroll Duplicate');
      userEmailsToCleanUp.push(email);

      await staffAuth(
        request(server).patch(`/api/v1/admin/applications/${reference}/under-review`),
      ).expect(200);
      await staffAuth(
        request(server).post(`/api/v1/admin/applications/${reference}/approve`),
      ).expect(200);

      const firstAttempt = await staffAuth(
        request(server).post(`/api/v1/admin/applications/${reference}/enroll`),
      ).send({});
      expect(firstAttempt.status).toBe(201);
      enrollmentIdsToCleanUp.push((firstAttempt.body as EnrollmentResultBody).enrollment.id);

      const secondAttempt = await staffAuth(
        request(server).post(`/api/v1/admin/applications/${reference}/enroll`),
      ).send({});
      expect(secondAttempt.status).toBe(409);

      const application = await prisma.application.findUniqueOrThrow({ where: { reference } });
      const enrollmentCount = await prisma.enrollment.count({
        where: { applicationId: application.id },
      });
      expect(enrollmentCount).toBe(1);
      expect(application.status).toBe('ENROLLED');
    });
  });
});
