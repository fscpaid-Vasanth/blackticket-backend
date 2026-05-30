import { Controller, Get, Post, Body, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { WalletService } from "./wallet.service";
import { CreateWithdrawDto } from "./dto/create-withdraw.dto";
import { JwtAuthGuard } from "../../guards/jwt-auth.guard";

@ApiTags("Wallet & Ledger Balance")
@Controller("wallet")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: "Retrieve active spendable balance, pending escrow holding, and transaction ledger" })
  @ApiResponse({ status: 200, description: "Successfully retrieved wallet history" })
  async getWallet(@Request() req: any) {
    return this.walletService.getWallet(req.user.id);
  }

  @Post("withdraw")
  @ApiOperation({ summary: "Initiate IMPS instant bank transfer payout request" })
  @ApiResponse({ status: 201, description: "Withdrawal registered, funds held on review status" })
  async requestWithdraw(@Request() req: any, @Body() createWithdrawDto: CreateWithdrawDto) {
    return this.walletService.requestWithdraw(req.user.id, createWithdrawDto);
  }
}
