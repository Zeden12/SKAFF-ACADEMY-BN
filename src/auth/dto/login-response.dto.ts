import { ApiProperty } from '@nestjs/swagger';

import { UserSummaryDto } from './user-summary.dto';

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT bearer token to send as `Authorization: Bearer <token>`' })
  accessToken!: string;

  @ApiProperty({ type: UserSummaryDto })
  user!: UserSummaryDto;
}
