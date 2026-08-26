import { randomBytes } from 'crypto';

import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  ApplicationHistoryActorType,
  ApplicationHistoryVisibility,
  ApplicationStatus,
  ClassGroup,
  Enrollment,
  EnrollmentStatus,
  Prisma,
  StudentStatus,
  UserType,
} from '@prisma/client';
import * as argon2 from 'argon2';

import { PrismaService } from '../prisma/prisma.service';
import { SequenceService } from '../prisma/sequence.service';
import { assertValidTransition } from './application-status.policy';
import { historyEntryData } from './application-history.util';
import { normalizeEmail } from './application.util';
import { ApplicationsService } from './applications.service';
import { EnrollApplicationDto } from './dto/enroll-application.dto';
import { EnrollmentResultDto } from './dto/enrollment-result.dto';

/**
 * Explicit, STAFF-only conversion of an APPROVED application into a real
 * student: User (+ StudentProfile if the account doesn't have one yet) +
 * Enrollment. Approval never does this automatically — see
 * ApplicationStatusPolicy and AdminApplicationsService.approve.
 */
@Injectable()
export class EnrollmentConversionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceService: SequenceService,
    private readonly applicationsService: ApplicationsService,
  ) {}

  async enroll(
    reference: string,
    dto: EnrollApplicationDto,
    actorName: string,
  ): Promise<EnrollmentResultDto> {
    const application = await this.applicationsService.findByReference(reference);

    if (application.status !== ApplicationStatus.APPROVED) {
      throw new ConflictException('Only approved applications can be enrolled.');
    }
    assertValidTransition(application.status, ApplicationStatus.ENROLLED);

    const classGroup = await this.resolveClassGroup(
      dto.classGroupId,
      application.programId,
      application.intakeId,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      // Re-check fresh inside the transaction to close the race window
      // between the pre-check above and this write.
      const fresh = await tx.application.findUniqueOrThrow({ where: { id: application.id } });
      if (fresh.status !== ApplicationStatus.APPROVED) {
        throw new ConflictException('Only approved applications can be enrolled.');
      }

      const email = normalizeEmail(fresh.email);
      let user = await tx.user.findUnique({ where: { email }, include: { studentProfile: true } });

      if (user && user.userType !== UserType.STUDENT) {
        throw new ConflictException(
          `The email ${email} already belongs to a STAFF account and cannot be converted to a student.`,
        );
      }

      if (!user) {
        // No email/password-setup flow exists yet, so the account is created
        // inactive (cannot log in) with an unusable random password hash —
        // never a guessable default, never emailed anywhere. A future
        // activation flow (email verification + password set) will flip
        // isActive to true and set a real password.
        const placeholderHash = await argon2.hash(randomBytes(32).toString('hex'));
        user = await tx.user.create({
          data: {
            email,
            passwordHash: placeholderHash,
            userType: UserType.STUDENT,
            isActive: false,
          },
          include: { studentProfile: true },
        });
      }

      // A returning applicant (e.g. enrolling in a second program) already
      // has a StudentProfile — reuse it rather than creating a duplicate or
      // silently overwriting their existing profile data.
      let studentProfile = user.studentProfile;
      if (!studentProfile) {
        const studentNumber = await this.sequenceService.nextStudentNumber(tx);
        studentProfile = await tx.studentProfile.create({
          data: {
            userId: user.id,
            studentNumber,
            fullName: fresh.fullName,
            phone: fresh.phone,
            dateOfBirth: fresh.dateOfBirth,
            nationality: fresh.nationality,
            address: fresh.currentAddress,
            status: StudentStatus.ACTIVE,
          },
        });
      }

      const enrollment = await this.createEnrollment(tx, {
        studentId: studentProfile.id,
        programId: fresh.programId,
        intakeId: fresh.intakeId,
        classGroupId: classGroup?.id ?? null,
        applicationId: fresh.id,
      });

      await tx.application.update({
        where: { id: fresh.id },
        data: { status: ApplicationStatus.ENROLLED, enrolledAt: new Date() },
      });

      await tx.applicationHistoryEntry.create({
        data: historyEntryData(fresh.id, 'Enrolled', ApplicationHistoryActorType.STAFF, {
          actorName,
          visibility: ApplicationHistoryVisibility.PUBLIC,
        }),
      });

      return { user, studentProfile, enrollment };
    });

    return {
      applicationReference: application.reference,
      user: { id: result.user.id, email: result.user.email, isActive: result.user.isActive },
      student: {
        id: result.studentProfile.id,
        studentNumber: result.studentProfile.studentNumber,
        fullName: result.studentProfile.fullName,
      },
      enrollment: {
        id: result.enrollment.id,
        status: result.enrollment.status,
        programId: result.enrollment.programId,
        intakeId: result.enrollment.intakeId,
        classGroupId: result.enrollment.classGroupId,
      },
    };
  }

  private async resolveClassGroup(
    classGroupId: string | undefined,
    programId: string,
    intakeId: string,
  ): Promise<ClassGroup | null> {
    if (!classGroupId) {
      return null;
    }

    const classGroup = await this.prisma.classGroup.findUnique({ where: { id: classGroupId } });

    if (!classGroup) {
      throw new BadRequestException(`ClassGroup "${classGroupId}" was not found`);
    }
    if (classGroup.programId !== programId || classGroup.intakeId !== intakeId) {
      throw new BadRequestException(
        'The selected class group does not belong to the same program and intake as this application.',
      );
    }

    return classGroup;
  }

  private async createEnrollment(
    tx: Prisma.TransactionClient,
    data: Prisma.EnrollmentUncheckedCreateInput,
  ): Promise<Enrollment> {
    try {
      return await tx.enrollment.create({ data: { ...data, status: EnrollmentStatus.ACTIVE } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'This application has already been converted to an enrollment.',
        );
      }
      throw error;
    }
  }
}
