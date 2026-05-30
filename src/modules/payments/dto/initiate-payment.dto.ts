import { IsNotEmpty, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class InitiatePaymentDto {
  @ApiProperty({ example: "order-uuid-123", description: "Order UUID to pay for" })
  @IsNotEmpty()
  @IsUUID()
  orderId: string;
}
