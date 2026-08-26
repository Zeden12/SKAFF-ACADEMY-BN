import { Intake, IntakeStatus, Prisma } from '@prisma/client';

/**
 * Single source of truth for "is this intake currently accepting
 * applications" — used both to re-validate a specific intake at application
 * creation time and to build the DB query for "the current eligible intake".
 *
 * An intake accepts applications only when:
 *  - applicationsOpen = true
 *  - status is not COMPLETED/CANCELLED
 *  - applicationOpenAt has passed, if set
 *  - applicationCloseAt has not passed, if set
 */
export function isIntakeAcceptingApplications(intake: Intake, now: Date = new Date()): boolean {
  if (!intake.applicationsOpen) {
    return false;
  }
  if (intake.status === IntakeStatus.COMPLETED || intake.status === IntakeStatus.CANCELLED) {
    return false;
  }
  if (intake.applicationOpenAt && intake.applicationOpenAt > now) {
    return false;
  }
  if (intake.applicationCloseAt && intake.applicationCloseAt < now) {
    return false;
  }
  return true;
}

/** Prisma `where` fragment implementing the same rule, for DB-side filtering. */
export function intakeEligibilityWhere(now: Date = new Date()): Prisma.IntakeWhereInput {
  return {
    applicationsOpen: true,
    status: { notIn: [IntakeStatus.COMPLETED, IntakeStatus.CANCELLED] },
    AND: [
      { OR: [{ applicationOpenAt: null }, { applicationOpenAt: { lte: now } }] },
      { OR: [{ applicationCloseAt: null }, { applicationCloseAt: { gte: now } }] },
    ],
  };
}
