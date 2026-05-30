import { IsNotEmpty, IsNumber, Min, IsObject } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class BankDetailsDto {
  @ApiProperty({ example: "1234567890", description: "Bank Account Number" })
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({ example: "HDFC0001234", description: "Bank IFSC Code" })
  @IsNotEmpty()
  ifscCode: string;

  @ApiProperty({ example: "Suresh Kumar", description: "Account Holder Name" })
  @IsNotEmpty()
  accountHolderName: string;
}

export class CreateWithdrawDto {
  @ApiProperty({ example: 500, description: "Amount in INR to withdraw" })
  @IsNotEmpty()
  @IsNumber()
  @Min(100) // Minimum withdrawal limit
  amount: number;

  @ApiProperty({
    description: "Bank details payload",
    type: BankDetailsDto,
  })
  @IsNotEmpty()
  @IsObject()
  bankDetails: BankDetailsDto;
}
