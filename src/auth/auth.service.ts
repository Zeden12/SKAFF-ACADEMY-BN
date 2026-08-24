import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StaffProfile, StudentProfile, User } from '@prisma/client';
import * as argon2 from 'argon2';

import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { UserSummaryDto } from './dto/user-summary.dto';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';

const GENERIC_LOGIN_ERROR = 'Invalid email or password';

type UserSummarySource = Pick<User, 'id' | 'email' | 'userType' | 'isActive'> & {
  studentProfile: StudentProfile | null;
  staffProfile: StaffProfile | null;
};

const PROFILES_INCLUDE = { studentProfile: true, staffProfile: true } as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const email = normalizeEmail(dto.email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: PROFILES_INCLUDE,
    });

    // Unknown email and inactive account are reported identically to a wrong
    // password, so a caller can't use login responses to enumerate accounts
    // or learn an account's active state.
    if (!user || !user.isActive) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);

    if (!passwordValid) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      userType: user.userType,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: this.toUserSummary(user),
    };
  }

  /**
   * Used by JwtStrategy on every authenticated request so a token issued
   * before an account was deactivated stops working immediately.
   */
  async getActiveUserById(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: PROFILES_INCLUDE,
    });

    if (!user || !user.isActive) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      userType: user.userType,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      studentProfile: user.studentProfile,
      staffProfile: user.staffProfile,
    };
  }

  toUserSummary(user: UserSummarySource): UserSummaryDto {
    return {
      id: user.id,
      email: user.email,
      userType: user.userType,
      isActive: user.isActive,
      studentProfile: user.studentProfile
        ? {
            id: user.studentProfile.id,
            studentNumber: user.studentProfile.studentNumber,
            fullName: user.studentProfile.fullName,
            status: user.studentProfile.status,
          }
        : null,
      staffProfile: user.staffProfile
        ? {
            id: user.staffProfile.id,
            fullName: user.staffProfile.fullName,
            status: user.staffProfile.status,
          }
        : null,
    };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
