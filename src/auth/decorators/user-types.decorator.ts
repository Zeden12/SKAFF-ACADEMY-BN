import { SetMetadata } from '@nestjs/common';
import { UserType } from '@prisma/client';

export const USER_TYPES_KEY = 'userTypes';

/**
 * Restricts a route to the given account types (STUDENT / STAFF).
 * Must be combined with JwtAuthGuard + UserTypesGuard.
 */
export const UserTypes = (...userTypes: UserType[]): MethodDecorator & ClassDecorator =>
  SetMetadata(USER_TYPES_KEY, userTypes);
