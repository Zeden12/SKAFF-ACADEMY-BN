import { Server } from 'http';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IntakeStatus } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

interface ApplicationBody {
  reference: string;
  status: string;
  fullName?: string;
  applicantFacingMessage?: string | null;
  history?: { visibility: string; action: string }[];
  message?: string;
}

const COMPLETE_EDUCATION = {
  highestEducationLevel: 'SECONDARY',
  previousInstitution: 'Green Hills Academy',
  completionYear: 2024,
};

describe('Applications (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaService;

  let openProgramId: string;
  let openIntakeId: string;
  let closedIntakeId: string;
  let futureIntakeId: string;
  let expiredIntakeId: string;

  const createdApplicationIds: string[] = [];

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

    const program = await prisma.program.findUniqueOrThrow({ where: { slug: 'ui-ux-design' } });
    openProgramId = program.id;

    const openIntake = await prisma.intake.create({
      data: {
        name: '[e2e] Open intake',
        programId: program.id,
        status: IntakeStatus.ACTIVE,
        applicationsOpen: true,
      },
    });
    openIntakeId = openIntake.id;

    const closedIntake = await prisma.intake.create({
      data: {
        name: '[e2e] Closed intake',
        programId: program.id,
        status: IntakeStatus.ACTIVE,
        applicationsOpen: false,
      },
    });
    closedIntakeId = closedIntake.id;

    const futureIntake = await prisma.intake.create({
      data: {
        name: '[e2e] Future intake',
        programId: program.id,
        status: IntakeStatus.UPCOMING,
        applicationsOpen: true,
        applicationOpenAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    futureIntakeId = futureIntake.id;

    const expiredIntake = await prisma.intake.create({
      data: {
        name: '[e2e] Expired intake',
        programId: program.id,
        status: IntakeStatus.ACTIVE,
        applicationsOpen: true,
        applicationCloseAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    });
    expiredIntakeId = expiredIntake.id;
  });

  afterAll(async () => {
    await prisma.application.deleteMany({ where: { id: { in: createdApplicationIds } } });
    await prisma.intake.deleteMany({
      where: { id: { in: [openIntakeId, closedIntakeId, futureIntakeId, expiredIntakeId] } },
    });
    await app.close();
  });

  async function createDraft(intakeId: string, email: string): Promise<request.Response> {
    return request(server).post('/api/v1/applications').send({
      programId: openProgramId,
      intakeId,
      fullName: 'E2E Test Applicant',
      email,
      phone: '+250788123456',
    });
  }

  describe('POST /api/v1/applications', () => {
    it('creates a DRAFT application against an open intake', async () => {
      const response = await createDraft(openIntakeId, 'e2e.draft@example.test');
      expect(response.status).toBe(201);
      const body = response.body as ApplicationBody;
      expect(body.status).toBe('DRAFT');
      expect(body.reference).toMatch(/^SKA-APP-\d{4}-\d{4}$/);
      createdApplicationIds.push(await idFor(prisma, body.reference));
    });

    it('generates unique references for successive applications', async () => {
      const first = await createDraft(openIntakeId, 'e2e.unique1@example.test');
      const second = await createDraft(openIntakeId, 'e2e.unique2@example.test');
      const firstBody = first.body as ApplicationBody;
      const secondBody = second.body as ApplicationBody;

      expect(firstBody.reference).not.toBe(secondBody.reference);
      createdApplicationIds.push(
        await idFor(prisma, firstBody.reference),
        await idFor(prisma, secondBody.reference),
      );
    });

    it('rejects creation against a closed intake', async () => {
      const response = await createDraft(closedIntakeId, 'e2e.closed@example.test');
      expect(response.status).toBe(400);
    });

    it('rejects creation against an intake that has not opened yet', async () => {
      const response = await createDraft(futureIntakeId, 'e2e.future@example.test');
      expect(response.status).toBe(400);
    });

    it('rejects creation against an intake whose application window has expired', async () => {
      const response = await createDraft(expiredIntakeId, 'e2e.expired@example.test');
      expect(response.status).toBe(400);
    });
  });

  describe('Draft update, submission, and verification', () => {
    let reference: string;
    const email = 'e2e.lifecycle@example.test';

    beforeAll(async () => {
      const response = await createDraft(openIntakeId, email);
      reference = (response.body as ApplicationBody).reference;
      createdApplicationIds.push(await idFor(prisma, reference));
    });

    it('rejects an update with the wrong verification email as if the application did not exist', async () => {
      await request(server)
        .patch(`/api/v1/applications/${reference}`)
        .send({ verificationEmail: 'not.the.owner@example.test', fullName: 'Someone Else' })
        .expect(404);
    });

    it('updates the draft with the correct verification email', async () => {
      const response = await request(server)
        .patch(`/api/v1/applications/${reference}`)
        .send({ verificationEmail: email, fullName: 'Updated Applicant Name' })
        .expect(200);

      expect((response.body as ApplicationBody).fullName).toBe('Updated Applicant Name');
    });

    it('rejects submission while required fields are still missing', async () => {
      const response = await request(server)
        .post(`/api/v1/applications/${reference}/submit`)
        .send({ verificationEmail: email })
        .expect(400);

      expect((response.body as { message: string }).message).toContain('highestEducationLevel');
    });

    it('submits once required fields are complete', async () => {
      await request(server)
        .patch(`/api/v1/applications/${reference}`)
        .send({ verificationEmail: email, ...COMPLETE_EDUCATION })
        .expect(200);

      const response = await request(server)
        .post(`/api/v1/applications/${reference}/submit`)
        .send({ verificationEmail: email })
        .expect(200);

      expect((response.body as ApplicationBody).status).toBe('SUBMITTED');
    });

    it('rejects submitting the same application twice', async () => {
      await request(server)
        .post(`/api/v1/applications/${reference}/submit`)
        .send({ verificationEmail: email })
        .expect(409);
    });
  });

  describe('GET /api/v1/applications/:reference/status', () => {
    it('never exposes internal notes or INTERNAL history, even for an application that has them', async () => {
      // Seeded fixture with a known INTERNAL history entry and internal notes.
      const response = await request(server)
        .get('/api/v1/applications/SKA-APP-2026-9006/status')
        .query({ verificationEmail: 'rejected.applicant@example.test' })
        .expect(200);
      const body = response.body as ApplicationBody & { internalAdminNotes?: unknown };

      expect(body.internalAdminNotes).toBeUndefined();
      expect(body.history?.every((entry) => entry.visibility === 'PUBLIC')).toBe(true);
      expect(body.history?.some((entry) => entry.action === 'Internal rejection notes added')).toBe(
        false,
      );
    });

    it('returns 404 for a wrong verification email rather than confirming the reference exists', async () => {
      await request(server)
        .get('/api/v1/applications/SKA-APP-2026-9006/status')
        .query({ verificationEmail: 'wrong@example.test' })
        .expect(404);
    });

    it('returns 404 for a well-formed but nonexistent reference', async () => {
      await request(server)
        .get('/api/v1/applications/SKA-APP-2026-0000/status')
        .query({ verificationEmail: 'anyone@example.test' })
        .expect(404);
    });
  });
});

async function idFor(prisma: PrismaService, reference: string): Promise<string> {
  const application = await prisma.application.findUniqueOrThrow({ where: { reference } });
  return application.id;
}
