import {
  PrismaClient,
  UserType,
  StudentStatus,
  StaffStatus,
  IntakeStatus,
  ClassStatus,
  EnrollmentStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SKAFF Academy database...');

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
      description:
        'Software development training covering both frontend and backend development.',
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
      description:
        'Practical user interface and user experience design training.',
    },
    {
      name: 'Power of AI',
      slug: 'power-of-ai',
      code: 'AI',
      displayOrder: 7,
      description:
        'Training focused on understanding and applying artificial intelligence.',
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
  // Not official Academy personnel.
  // Used only to test relationships before real auth/users.
  // =====================================================

  const staffUser = await prisma.user.upsert({
    where: {
      email: 'trainer@skaffacademy.local',
    },
    update: {},
    create: {
      email: 'trainer@skaffacademy.local',
      passwordHash: 'SEED_ONLY_NOT_REAL_PASSWORD',
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
    update: {},
    create: {
      id: 'seed-intake-fullstack-2026',
      name: 'Full-Stack Development 2026 Intake',
      programId: fullStack.id,
      status: IntakeStatus.ACTIVE,
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
  // =====================================================

  const studentUser = await prisma.user.upsert({
    where: {
      email: 'student@skaffacademy.local',
    },
    update: {},
    create: {
      email: 'student@skaffacademy.local',
      passwordHash: 'SEED_ONLY_NOT_REAL_PASSWORD',
      userType: UserType.STUDENT,
      isActive: true,
    },
  });

  const studentProfile = await prisma.studentProfile.upsert({
    where: {
      userId: studentUser.id,
    },
    update: {},
    create: {
      userId: studentUser.id,
      studentNumber: 'SKF-2026-0001',
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