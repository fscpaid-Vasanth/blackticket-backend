import { Controller, Post, Body, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { PaymentsService } from "./payments.service";
import { InitiatePaymentDto } from "./dto/initiate-payment.dto";
import { VerifyPaymentDto } from "./dto/verify-payment.dto";
import { JwtAuthGuard } from "../../guards/jwt-auth.guard";

@ApiTags("Payments (Razorpay Gateway)")
@Controller("payments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("initiate")
  @ApiOperation({ summary: "Create a Razorpay Order to initiate a ticket purchase checkout" })
  @ApiResponse({ status: 200, description: "Successfully initiated, returns Razorpay Order object" })
  async initiate(@Request() req: any, @Body() initiatePaymentDto: InitiatePaymentDto) {
    return this.paymentsService.initiate(req.user.id, initiatePaymentDto);
  }

  @Post("verify")
  @ApiOperation({ summary: "Verify signature and complete ticket purchase escrow transaction" })
  @ApiResponse({ status: 200, description: "Payment verified, listing sold, and escrow holds activated" })
  async verify(@Request() req: any, @Body() verifyPaymentDto: VerifyPaymentDto) {
    return this.paymentsService.verify(req.user.id, verifyPaymentDto);
  }
}
