import { ConflictException } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';

import { assertValidTransition, canTransition } from './application-status.policy';

describe('application-status.policy', () => {
  it('allows the documented happy-path transitions', () => {
    expect(canTransition(ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED)).toBe(true);
    expect(canTransition(ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW)).toBe(true);
    expect(canTransition(ApplicationStatus.UNDER_REVIEW, ApplicationStatus.APPROVED)).toBe(true);
    expect(canTransition(ApplicationStatus.UNDER_REVIEW, ApplicationStatus.REJECTED)).toBe(true);
    expect(
      canTransition(ApplicationStatus.UNDER_REVIEW, ApplicationStatus.MORE_INFORMATION_REQUIRED),
    ).toBe(true);
    expect(
      canTransition(ApplicationStatus.MORE_INFORMATION_REQUIRED, ApplicationStatus.SUBMITTED),
    ).toBe(true);
    expect(canTransition(ApplicationStatus.APPROVED, ApplicationStatus.ENROLLED)).toBe(true);
  });

  it('rejects skipping straight from REJECTED to APPROVED', () => {
    expect(canTransition(ApplicationStatus.REJECTED, ApplicationStatus.APPROVED)).toBe(false);
    expect(() =>
      assertValidTransition(ApplicationStatus.REJECTED, ApplicationStatus.APPROVED),
    ).toThrow(ConflictException);
  });

  it('rejects moving an ENROLLED application back to UNDER_REVIEW', () => {
    expect(canTransition(ApplicationStatus.ENROLLED, ApplicationStatus.UNDER_REVIEW)).toBe(false);
  });

  it('rejects an applicant-style jump straight to APPROVED', () => {
    expect(canTransition(ApplicationStatus.DRAFT, ApplicationStatus.APPROVED)).toBe(false);
    expect(canTransition(ApplicationStatus.SUBMITTED, ApplicationStatus.APPROVED)).toBe(false);
  });

  it('treats REJECTED and ENROLLED as terminal', () => {
    expect(canTransition(ApplicationStatus.REJECTED, ApplicationStatus.SUBMITTED)).toBe(false);
    expect(canTransition(ApplicationStatus.ENROLLED, ApplicationStatus.SUBMITTED)).toBe(false);
  });
});
