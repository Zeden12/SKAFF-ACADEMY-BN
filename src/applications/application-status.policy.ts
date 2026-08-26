import { ConflictException } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';

/**
 * Single source of truth for the admissions state graph. Every status change
 * anywhere in the applications domain must go through `assertValidTransition`
 * — never mutate `status` directly in a service without it.
 *
 * DRAFT                      → SUBMITTED
 * SUBMITTED                  → UNDER_REVIEW
 * UNDER_REVIEW                → MORE_INFORMATION_REQUIRED | APPROVED | REJECTED
 * MORE_INFORMATION_REQUIRED  → SUBMITTED
 * APPROVED                   → ENROLLED (only via enrollment conversion)
 * REJECTED, ENROLLED          → (terminal)
 */
const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.DRAFT]: [ApplicationStatus.SUBMITTED],
  [ApplicationStatus.SUBMITTED]: [ApplicationStatus.UNDER_REVIEW],
  [ApplicationStatus.UNDER_REVIEW]: [
    ApplicationStatus.MORE_INFORMATION_REQUIRED,
    ApplicationStatus.APPROVED,
    ApplicationStatus.REJECTED,
  ],
  [ApplicationStatus.MORE_INFORMATION_REQUIRED]: [ApplicationStatus.SUBMITTED],
  [ApplicationStatus.APPROVED]: [ApplicationStatus.ENROLLED],
  [ApplicationStatus.REJECTED]: [],
  [ApplicationStatus.ENROLLED]: [],
};

export function canTransition(current: ApplicationStatus, next: ApplicationStatus): boolean {
  return ALLOWED_TRANSITIONS[current].includes(next);
}

export function assertValidTransition(current: ApplicationStatus, next: ApplicationStatus): void {
  if (!canTransition(current, next)) {
    throw new ConflictException(`Cannot move an application from ${current} to ${next}.`);
  }
}
