import { UserType } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  userType: UserType;
}
