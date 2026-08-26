import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RequestInformationDto {
  @ApiProperty({
    description:
      'Applicant-facing message explaining what is required. Shown verbatim to the applicant.',
    example: 'Please upload a clearer photo of your national ID.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}
