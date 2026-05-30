import { IsNotEmpty, IsString, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SendOtpDto {
  @ApiProperty({ example: "+919876543210", description: "Mobile number with country code" })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: "Mobile number must be a valid E.164 formatted telephone number",
  })
  mobile: string;
}
