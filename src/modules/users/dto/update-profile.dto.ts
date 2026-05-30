import { IsOptional, IsString, IsEmail } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateProfileDto {
  @ApiProperty({ example: "Ramesh Kumar", description: "Updated full name", required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: "ramesh.kumar@gmail.com", description: "Updated email address", required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: "Bengaluru", description: "Updated preferred resale market city", required: false })
  @IsOptional()
  @IsString()
  city?: string;
}
