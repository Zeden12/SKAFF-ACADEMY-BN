import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/**
 * Interim, pre-authentication applicant verification: proving you know the
 * email an application was created with. This is NOT strong authentication —
 * there is no OTP/email-link confirmation yet — but it stops a bare
 * reference number (which is not a secret) from being enough on its own to
 * read or modify someone else's application. Extend/replace with real
 * applicant accounts in a future phase.
 */
export class ApplicantVerificationDto {
  @ApiProperty({
    description: 'The email address this application was created with.',
    example: 'applicant@example.com',
  })
  @IsEmail()
  verificationEmail!: string;
}
