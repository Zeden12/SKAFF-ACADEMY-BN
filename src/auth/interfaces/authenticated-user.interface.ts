import { StaffProfile, StudentProfile, User } from '@prisma/client';

/**
 * The shape attached to `request.user` after JWT verification.
 * Never includes `passwordHash`.
 */
export type AuthenticatedUser = Omit<User, 'passwordHash'> & {
  studentProfile: StudentProfile | null;
  staffProfile: StaffProfile | null;
};
