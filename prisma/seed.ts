import {
  PrismaClient,
  Prisma,
  UserType,
  StudentStatus,
  StaffStatus,
  IntakeStatus,
  ClassStatus,
  EnrollmentStatus,
  ApplicationStatus,
  ApplicationHistoryActorType,
  ApplicationHistoryVisibility,
  EducationLevel,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Development-only login for both seeded accounts below. Never used in
// staging/production — real accounts get real, unique passwords through the
// (future) account-creation flow, not the seed script.
const DEV_PASSWORD = 'SkaffDev2026!';

interface SeedHistoryEntry {
  action: string;
  actorType: ApplicationHistoryActorType;
  actorName?: string;
  message?: string;
  visibility: ApplicationHistoryVisibility;
}

/**
 * Upserts a demo Application by fixed id and replaces its history entries,
 * so rerunning the seed stays idempotent. References use the 9000+ range,
 * clearly outside the real SequenceCounter-driven range (which starts at 1
 * each year), so there is no collision with real applications.
 */
async function upsertSeedApplication(
  id: string,
  data: Omit<Prisma.ApplicationUncheckedCreateInput, 'id'>,
  history: SeedHistoryEntry[],
): Promise<void> {
  const application = await prisma.application.upsert({
    where: { id },
    update: data,
    create: { id, ...data },
  });

  await prisma.applicationHistoryEntry.deleteMany({ where: { applicationId: application.id } });

  for (const entry of history) {
    await prisma.applicationHistoryEntry.create({
      data: {
        applicationId: application.id,
        action: entry.action,
        actorType: entry.actorType,
        actorName: entry.actorName ?? null,
        message: entry.message ?? null,
        visibility: entry.visibility,
      },
    });
  }
}

async function main() {
  console.log('Seeding SKAFF Academy database...');

  const devPasswordHash = await argon2.hash(DEV_PASSWORD);

  // =====================================================
  // REAL SKAFF ACADEMY PROGRAM CATALOG
  // Source: SKAFF ACADEMY ADMISSION FULL INFO
  // Keep this official display order.
  // =====================================================

  const programs = [
    {
      name: 'Video Production',
      slug: 'video-production',
      code: 'VID',
      displayOrder: 1,
      description:
        'Practical training covering video production, television production, editing, photography, lighting, cinematography and related creative production skills.',
    },
    {
      name: 'Audio Production',
      slug: 'audio-production',
      code: 'AUD',
      displayOrder: 2,
      description:
        'Practical audio production training including beat making, vocal recording, mastering, mixing and piano lessons.',
    },
    {
      name: 'Full-Stack Development',
      slug: 'full-stack-development',
      code: 'FSD',
      displayOrder: 3,
      description: 'Software development training covering both frontend and backend development.',
    },
    {
      name: 'Backend Development',
      slug: 'backend-development',
      code: 'BED',
      displayOrder: 4,
      description:
        'Backend software development training focused on server-side application development.',
    },
    {
      name: 'Frontend Development',
      slug: 'frontend-development',
      code: 'FED',
      displayOrder: 5,
      description:
        'Frontend software development training focused on modern user-facing web applications.',
    },
    {
      name: 'UI/UX Design',
      slug: 'ui-ux-design',
      code: 'UIUX',
      displayOrder: 6,
      description: 'Practical user interface and user experience design training.',
    },
    {
      name: 'Power of AI',
      slug: 'power-of-ai',
      code: 'AI',
      displayOrder: 7,
      description: 'Training focused on understanding and applying artificial intelligence.',
    },
    {
      name: 'Digital Marketing & Social Media Management',
      slug: 'digital-marketing-social-media-management',
      code: 'DMSM',
      displayOrder: 8,
      description:
        'Training covering digital marketing strategies, social media management and content creation.',
    },
  ];

  for (const program of programs) {
    await prisma.program.upsert({
      where: {
        slug: program.slug,
      },
      update: {
        name: program.name,
        code: program.code,
        displayOrder: program.displayOrder,
        description: program.description,
        isActive: true,
      },
      create: {
        ...program,
        isActive: true,
      },
    });
  }

  console.log(`Seeded ${programs.length} SKAFF Academy programs.`);

  // =====================================================
  // DEVELOPMENT STAFF USER
  // Not official Academy personnel. Dev-only login, see README:
  // trainer@skaffacademy.local / SkaffDev2026!
  // =====================================================

  const staffUser = await prisma.user.upsert({
    where: {
      email: 'trainer@skaffacademy.local',
    },
    update: {
      passwordHash: devPasswordHash,
    },
    create: {
      email: 'trainer@skaffacademy.local',
      passwordHash: devPasswordHash,
      userType: UserType.STAFF,
      isActive: true,
    },
  });

  const staffProfile = await prisma.staffProfile.upsert({
    where: {
      userId: staffUser.id,
    },
    update: {},
    create: {
      userId: staffUser.id,
      fullName: 'SKAFF Academy Trainer',
      phone: '+250700000001',
      status: StaffStatus.ACTIVE,
    },
  });

  // =====================================================
  // DEVELOPMENT INTAKE
  // This is test data, NOT an official published intake.
  // applicationsOpen: true so the public admissions flow can be
  // exercised end-to-end in development.
  // =====================================================

  const fullStack = await prisma.program.findUniqueOrThrow({
    where: {
      slug: 'full-stack-development',
    },
  });

  const intake = await prisma.intake.upsert({
    where: {
      id: 'seed-intake-fullstack-2026',
    },
    update: {
      applicationsOpen: true,
    },
    create: {
      id: 'seed-intake-fullstack-2026',
      name: 'Full-Stack Development 2026 Intake',
      programId: fullStack.id,
      status: IntakeStatus.ACTIVE,
      applicationsOpen: true,
    },
  });

  // =====================================================
  // DEVELOPMENT CLASS
  // =====================================================

  const classGroup = await prisma.classGroup.upsert({
    where: {
      code: 'FSD-2026-A',
    },
    update: {},
    create: {
      name: 'Full-Stack Development Cohort A',
      code: 'FSD-2026-A',
      programId: fullStack.id,
      intakeId: intake.id,
      trainerId: staffProfile.id,
      status: ClassStatus.ACTIVE,
    },
  });

  // =====================================================
  // DEVELOPMENT STUDENT
  // Dev-only login, see README: student@skaffacademy.local / SkaffDev2026!
  // =====================================================

  const studentUser = await prisma.user.upsert({
    where: {
      email: 'student@skaffacademy.local',
    },
    update: {
      passwordHash: devPasswordHash,
    },
    create: {
      email: 'student@skaffacademy.local',
      passwordHash: devPasswordHash,
      userType: UserType.STUDENT,
      isActive: true,
    },
  });

  // studentNumber uses the 9000+ range reserved for seed/demo data (see the
  // admissions block below) — NOT 0001, which would collide with the first
  // real student number SequenceService generates for 2026.
  const studentProfile = await prisma.studentProfile.upsert({
    where: {
      userId: studentUser.id,
    },
    update: {
      studentNumber: 'SKF-2026-9000',
    },
    create: {
      userId: studentUser.id,
      studentNumber: 'SKF-2026-9000',
      fullName: 'Aline Uwimana',
      phone: '+250700000002',
      nationality: 'Rwandan',
      address: 'Kigali, Rwanda',
      status: StudentStatus.ACTIVE,
    },
  });

  // =====================================================
  // DEVELOPMENT ENROLLMENT
  // Links student → program → intake → class
  // =====================================================

  await prisma.enrollment.upsert({
    where: {
      studentId_intakeId: {
        studentId: studentProfile.id,
        intakeId: intake.id,
      },
    },
    update: {
      programId: fullStack.id,
      classGroupId: classGroup.id,
      status: EnrollmentStatus.ACTIVE,
    },
    create: {
      studentId: studentProfile.id,
      programId: fullStack.id,
      intakeId: intake.id,
      classGroupId: classGroup.id,
      status: EnrollmentStatus.ACTIVE,
    },
  });

  console.log('Development academic relationships seeded.');

  // =====================================================
  // DEVELOPMENT ADMISSIONS DATA
  // Demonstrates every Application status against the open
  // Full-Stack Development 2026 intake above. Fictional
  // applicants (@example.test) — NOT real SKAFF admissions
  // records. References use the 9000+ range so they never
  // collide with real, sequence-generated references (which
  // start at 0001 each year).
  //
  // The ENROLLED row is a status/history demo only — it does
  // not wire up a real User/StudentProfile/Enrollment chain
  // the way the actual POST /admin/applications/:reference/enroll
  // endpoint does. Use the APPROVED row (or the real endpoints)
  // to exercise a genuine enrollment conversion.
  // =====================================================

  const dayMs = 24 * 60 * 60 * 1000;
  const daysAgo = (days: number): Date => new Date(Date.now() - days * dayMs);

  const completeEducation = {
    highestEducationLevel: EducationLevel.SECONDARY,
    previousInstitution: 'Green Hills Academy',
    fieldOfStudy: 'General Sciences',
    completionYear: 2024,
    educationNotes: 'Completed advanced-level sciences.',
  };

  await upsertSeedApplication(
    'seed-application-draft',
    {
      reference: 'SKA-APP-2026-9001',
      programId: fullStack.id,
      intakeId: intake.id,
      status: ApplicationStatus.DRAFT,
      fullName: 'Eric Niyonshuti',
      email: 'draft.applicant@example.test',
      phone: '+250788009001',
      nationality: 'Rwandan',
      currentAddress: 'Kigali, Rwanda',
    },
    [
      {
        action: 'Application created',
        actorType: ApplicationHistoryActorType.APPLICANT,
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
    ],
  );

  await upsertSeedApplication(
    'seed-application-submitted',
    {
      reference: 'SKA-APP-2026-9002',
      programId: fullStack.id,
      intakeId: intake.id,
      status: ApplicationStatus.SUBMITTED,
      fullName: 'Claudine Mukamana',
      email: 'submitted.applicant@example.test',
      phone: '+250788009002',
      nationality: 'Rwandan',
      currentAddress: 'Musanze, Rwanda',
      ...completeEducation,
      submittedAt: daysAgo(1),
    },
    [
      {
        action: 'Application created',
        actorType: ApplicationHistoryActorType.APPLICANT,
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Submitted',
        actorType: ApplicationHistoryActorType.APPLICANT,
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
    ],
  );

  await upsertSeedApplication(
    'seed-application-under-review',
    {
      reference: 'SKA-APP-2026-9003',
      programId: fullStack.id,
      intakeId: intake.id,
      status: ApplicationStatus.UNDER_REVIEW,
      fullName: 'Patrick Ndayisenga',
      email: 'under-review.applicant@example.test',
      phone: '+250788009003',
      nationality: 'Rwandan',
      currentAddress: 'Huye, Rwanda',
      ...completeEducation,
      submittedAt: daysAgo(3),
      reviewedAt: daysAgo(2),
    },
    [
      {
        action: 'Application created',
        actorType: ApplicationHistoryActorType.APPLICANT,
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Submitted',
        actorType: ApplicationHistoryActorType.APPLICANT,
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Review started',
        actorType: ApplicationHistoryActorType.STAFF,
        actorName: 'SKAFF Academy Trainer',
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
    ],
  );

  await upsertSeedApplication(
    'seed-application-more-information-required',
    {
      reference: 'SKA-APP-2026-9004',
      programId: fullStack.id,
      intakeId: intake.id,
      status: ApplicationStatus.MORE_INFORMATION_REQUIRED,
      fullName: 'Diane Ingabire',
      email: 'more-info.applicant@example.test',
      phone: '+250788009004',
      nationality: 'Rwandan',
      currentAddress: 'Rubavu, Rwanda',
      ...completeEducation,
      submittedAt: daysAgo(5),
      reviewedAt: daysAgo(4),
      applicantFacingMessage: 'Please upload a clearer photo of your national ID.',
    },
    [
      {
        action: 'Application created',
        actorType: ApplicationHistoryActorType.APPLICANT,
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Submitted',
        actorType: ApplicationHistoryActorType.APPLICANT,
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Review started',
        actorType: ApplicationHistoryActorType.STAFF,
        actorName: 'SKAFF Academy Trainer',
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Additional information requested',
        actorType: ApplicationHistoryActorType.STAFF,
        actorName: 'SKAFF Academy Trainer',
        message: 'Please upload a clearer photo of your national ID.',
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
    ],
  );

  await upsertSeedApplication(
    'seed-application-approved',
    {
      reference: 'SKA-APP-2026-9005',
      programId: fullStack.id,
      intakeId: intake.id,
      status: ApplicationStatus.APPROVED,
      fullName: 'Robert Mugisha',
      email: 'approved.applicant@example.test',
      phone: '+250788009005',
      nationality: 'Rwandan',
      currentAddress: 'Kigali, Rwanda',
      ...completeEducation,
      submittedAt: daysAgo(7),
      reviewedAt: daysAgo(6),
      approvedAt: daysAgo(5),
    },
    [
      {
        action: 'Application created',
        actorType: ApplicationHistoryActorType.APPLICANT,
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Submitted',
        actorType: ApplicationHistoryActorType.APPLICANT,
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Review started',
        actorType: ApplicationHistoryActorType.STAFF,
        actorName: 'SKAFF Academy Trainer',
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Approved',
        actorType: ApplicationHistoryActorType.STAFF,
        actorName: 'SKAFF Academy Trainer',
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
    ],
  );

  await upsertSeedApplication(
    'seed-application-rejected',
    {
      reference: 'SKA-APP-2026-9006',
      programId: fullStack.id,
      intakeId: intake.id,
      status: ApplicationStatus.REJECTED,
      fullName: 'Sandrine Umutoni',
      email: 'rejected.applicant@example.test',
      phone: '+250788009006',
      nationality: 'Rwandan',
      currentAddress: 'Kigali, Rwanda',
      ...completeEducation,
      submittedAt: daysAgo(10),
      reviewedAt: daysAgo(9),
      rejectedAt: daysAgo(8),
      applicantFacingMessage:
        'Thank you for applying. We are unable to offer you a place in this intake.',
    },
    [
      {
        action: 'Application created',
        actorType: ApplicationHistoryActorType.APPLICANT,
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Submitted',
        actorType: ApplicationHistoryActorType.APPLICANT,
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Review started',
        actorType: ApplicationHistoryActorType.STAFF,
        actorName: 'SKAFF Academy Trainer',
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Rejected',
        actorType: ApplicationHistoryActorType.STAFF,
        actorName: 'SKAFF Academy Trainer',
        message: 'Thank you for applying. We are unable to offer you a place in this intake.',
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Internal rejection notes added',
        actorType: ApplicationHistoryActorType.STAFF,
        actorName: 'SKAFF Academy Trainer',
        message: 'Portfolio did not meet the bar for this intake — encourage a reapply next year.',
        visibility: ApplicationHistoryVisibility.INTERNAL,
      },
    ],
  );

  await upsertSeedApplication(
    'seed-application-enrolled',
    {
      reference: 'SKA-APP-2026-9007',
      programId: fullStack.id,
      intakeId: intake.id,
      status: ApplicationStatus.ENROLLED,
      fullName: 'Grace Keza',
      email: 'enrolled.applicant@example.test',
      phone: '+250788009007',
      nationality: 'Rwandan',
      currentAddress: 'Kigali, Rwanda',
      ...completeEducation,
      submittedAt: daysAgo(14),
      reviewedAt: daysAgo(13),
      approvedAt: daysAgo(12),
      enrolledAt: daysAgo(11),
    },
    [
      {
        action: 'Application created',
        actorType: ApplicationHistoryActorType.APPLICANT,
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Submitted',
        actorType: ApplicationHistoryActorType.APPLICANT,
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Review started',
        actorType: ApplicationHistoryActorType.STAFF,
        actorName: 'SKAFF Academy Trainer',
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Approved',
        actorType: ApplicationHistoryActorType.STAFF,
        actorName: 'SKAFF Academy Trainer',
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
      {
        action: 'Enrolled',
        actorType: ApplicationHistoryActorType.STAFF,
        actorName: 'SKAFF Academy Trainer',
        visibility: ApplicationHistoryVisibility.PUBLIC,
      },
    ],
  );

  console.log('Seeded 7 development applications covering every status.');
  console.log('SKAFF Academy seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
