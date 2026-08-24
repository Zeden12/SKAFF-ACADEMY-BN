import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserType } from '@prisma/client';

import { USER_TYPES_KEY } from '../decorators/user-types.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Must run after JwtAuthGuard so `request.user` is already populated.
 * Routes without an @UserTypes() decorator are allowed through unchanged.
 */
@Injectable()
export class UserTypesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTypes = this.reflector.getAllAndOverride<UserType[] | undefined>(USER_TYPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredTypes || requiredTypes.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();

    if (!requiredTypes.includes(user.userType)) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}
