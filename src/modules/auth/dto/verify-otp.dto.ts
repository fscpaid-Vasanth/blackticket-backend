import { IsNotEmpty, IsString, Length, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class VerifyOtpDto {
  @ApiProperty({ example: "+919876543210", description: "Mobile number with country code" })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: "Mobile number must be a valid E.164 formatted telephone number",
  })
  mobile: string;

  @ApiProperty({ example: "123456", description: "6-digit OTP sent to mobile" })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: "OTP code must be exactly 6 characters" })
  code: string;
}
