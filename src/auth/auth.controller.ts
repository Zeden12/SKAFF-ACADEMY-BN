import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserType } from '@prisma/client';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserTypes } from './decorators/user-types.decorator';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { UserSummaryDto } from './dto/user-summary.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserTypesGuard } from './guards/user-types.guard';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or inactive account' })
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiOkResponse({ type: UserSummaryDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  me(@CurrentUser() user: AuthenticatedUser): UserSummaryDto {
    return this.authService.toUserSummary(user);
  }

  /**
   * Demonstrates the STUDENT/STAFF authorization guard. Not a real feature
   * endpoint — safe to repurpose or remove once a genuine STAFF-only route
   * exists.
   */
  @Get('staff-only')
  @UseGuards(JwtAuthGuard, UserTypesGuard)
  @UserTypes(UserType.STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[Demo] Reachable only by an authenticated STAFF account' })
  @ApiOkResponse({ description: 'Only reachable by an authenticated STAFF user' })
  @ApiForbiddenResponse({ description: 'Authenticated but not a STAFF account' })
  staffOnly(@CurrentUser() user: AuthenticatedUser): { message: string; userType: UserType } {
    return { message: `Hello, staff member ${user.email}`, userType: user.userType };
  }
}
