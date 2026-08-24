import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'student@skaffacademy.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SkaffDev2026!' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
