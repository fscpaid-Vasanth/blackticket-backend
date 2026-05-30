import { IsNotEmpty, IsUUID, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class VerifyPaymentDto {
  @ApiProperty({ example: "order-uuid-123", description: "Order UUID inside BlackTicket" })
  @IsNotEmpty()
  @IsUUID()
  orderId: string;

  @ApiProperty({ example: "order_Kjkd93kdkl", description: "Razorpay Order ID" })
  @IsNotEmpty()
  @IsString()
  razorpayOrderId: string;

  @ApiProperty({ example: "pay_Jjkj98skdl", description: "Razorpay Payment ID" })
  @IsNotEmpty()
  @IsString()
  razorpayPaymentId: string;

  @ApiProperty({ example: "abcdefg123456...", description: "Razorpay signature verification hash" })
  @IsNotEmpty()
  @IsString()
  razorpaySignature: string;
}
