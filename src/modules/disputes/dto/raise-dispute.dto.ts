import { IsNotEmpty, IsUUID, IsString, IsArray, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RaiseDisputeDto {
  @ApiProperty({ example: "order-uuid-123", description: "Order UUID to raise dispute on" })
  @IsNotEmpty()
  @IsUUID()
  orderId: string;

  @ApiProperty({ example: "The QR code was already scanned by someone else.", description: "Reason for the dispute" })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({
    example: ["https://s3.amazonaws.com/blackticket/disputes/evidence1.jpg"],
    description: "Array of evidence image URLs uploaded by the buyer",
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceUrls?: string[];
}
