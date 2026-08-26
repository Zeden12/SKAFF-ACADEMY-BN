import { Intake, IntakeStatus } from '@prisma/client';

import { isIntakeAcceptingApplications } from './intake-eligibility.util';

const NOW = new Date('2026-08-25T12:00:00.000Z');

function baseIntake(overrides: Partial<Intake> = {}): Intake {
  return {
    id: 'intake-1',
    name: 'Test Intake',
    programId: 'program-1',
    status: IntakeStatus.ACTIVE,
    applicationsOpen: true,
    applicationOpenAt: null,
    applicationCloseAt: null,
    capacity: null,
    startDate: null,
    endDate: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('isIntakeAcceptingApplications', () => {
  it('accepts an open intake with no date window', () => {
    expect(isIntakeAcceptingApplications(baseIntake(), NOW)).toBe(true);
  });

  it('rejects when applicationsOpen is false', () => {
    expect(isIntakeAcceptingApplications(baseIntake({ applicationsOpen: false }), NOW)).toBe(false);
  });

  it('rejects a COMPLETED intake even if applicationsOpen is true', () => {
    expect(isIntakeAcceptingApplications(baseIntake({ status: IntakeStatus.COMPLETED }), NOW)).toBe(
      false,
    );
  });

  it('rejects a CANCELLED intake', () => {
    expect(isIntakeAcceptingApplications(baseIntake({ status: IntakeStatus.CANCELLED }), NOW)).toBe(
      false,
    );
  });

  it('rejects before applicationOpenAt', () => {
    const intake = baseIntake({ applicationOpenAt: new Date('2026-09-01T00:00:00.000Z') });
    expect(isIntakeAcceptingApplications(intake, NOW)).toBe(false);
  });

  it('accepts once applicationOpenAt has passed', () => {
    const intake = baseIntake({ applicationOpenAt: new Date('2026-08-01T00:00:00.000Z') });
    expect(isIntakeAcceptingApplications(intake, NOW)).toBe(true);
  });

  it('rejects after applicationCloseAt', () => {
    const intake = baseIntake({ applicationCloseAt: new Date('2026-08-01T00:00:00.000Z') });
    expect(isIntakeAcceptingApplications(intake, NOW)).toBe(false);
  });

  it('accepts within an open date window', () => {
    const intake = baseIntake({
      applicationOpenAt: new Date('2026-08-01T00:00:00.000Z'),
      applicationCloseAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(isIntakeAcceptingApplications(intake, NOW)).toBe(true);
  });
});
