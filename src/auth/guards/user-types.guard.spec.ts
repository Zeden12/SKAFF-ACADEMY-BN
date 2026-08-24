import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserType } from '@prisma/client';

import { UserTypesGuard } from './user-types.guard';

function createContext(userType: UserType): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: { userType } }),
    }),
  } as unknown as ExecutionContext;
}

describe('UserTypesGuard', () => {
  it('allows the request when no @UserTypes() metadata is set', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new UserTypesGuard(reflector);

    expect(guard.canActivate(createContext(UserType.STUDENT))).toBe(true);
  });

  it('allows a matching user type', () => {
    const reflector = {
      getAllAndOverride: () => [UserType.STAFF],
    } as unknown as Reflector;
    const guard = new UserTypesGuard(reflector);

    expect(guard.canActivate(createContext(UserType.STAFF))).toBe(true);
  });

  it('rejects a mismatched user type', () => {
    const reflector = {
      getAllAndOverride: () => [UserType.STAFF],
    } as unknown as Reflector;
    const guard = new UserTypesGuard(reflector);

    expect(() => guard.canActivate(createContext(UserType.STUDENT))).toThrow(ForbiddenException);
  });
});
