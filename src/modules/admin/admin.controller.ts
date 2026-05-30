import { Controller, Get, Patch, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { AdminService } from "./admin.service";
import { DisputesService } from "../disputes/disputes.service";
import { JwtAuthGuard } from "../../guards/jwt-auth.guard";
import { RolesGuard } from "../../guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "@prisma/client";
import { IsNotEmpty, IsString } from "class-validator";

export class RejectDto {
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class ResolveDisputeDto {
  @IsNotEmpty()
  @IsString()
  adminNotes: string;
}

@ApiTags("Admin Moderation Desk")
@Controller("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly disputesService: DisputesService
  ) {}

  // 1. Listings Moderation
  @Get("listings/pending")
  @ApiOperation({ summary: "Get all pending ticket resales awaiting moderation" })
  @ApiResponse({ status: 200, description: "Successfully retrieved pending listings list" })
  async getPendingListings() {
    return this.adminService.getPendingListings();
  }

  @Patch("listings/:id/approve")
  @ApiOperation({ summary: "Approve a resale ticket listing (Moves status to ACTIVE)" })
  @ApiResponse({ status: 200, description: "Listing approved and live for buyers" })
  async approveListing(@Param("id") id: string) {
    return this.adminService.approveListing(id);
  }

  @Patch("listings/:id/reject")
  @ApiOperation({ summary: "Reject and draft a resale ticket listing with feedback details" })
  @ApiResponse({ status: 200, description: "Listing marked rejected, seller notified" })
  async rejectListing(@Param("id") id: string, @Body() rejectDto: RejectDto) {
    return this.adminService.rejectListing(id, rejectDto.reason);
  }

  // 2. Withdrawals Moderation
  @Get("withdraws")
  @ApiOperation({ summary: "List all IMPS withdrawals requested by sellers" })
  @ApiResponse({ status: 200, description: "Successfully retrieved withdrawal request list" })
  async getWithdrawRequests() {
    return this.adminService.getWithdrawRequests();
  }

  @Patch("withdraws/:id/approve")
  @ApiOperation({ summary: "Mark a withdrawal request as successfully processed" })
  @ApiResponse({ status: 200, description: "Withdrawal approved" })
  async approveWithdraw(@Param("id") id: string) {
    return this.adminService.approveWithdraw(id);
  }

  @Patch("withdraws/:id/reject")
  @ApiOperation({ summary: "Reject a withdrawal request and issue wallet refund to seller" })
  @ApiResponse({ status: 200, description: "Withdrawal rejected, balance refunded" })
  async rejectWithdraw(@Param("id") id: string, @Body() rejectDto: RejectDto) {
    return this.adminService.rejectWithdraw(id, rejectDto.reason);
  }

  // 3. Disputes Arbitration
  @Get("disputes")
  @ApiOperation({ summary: "List all disputes raised by buyers" })
  @ApiResponse({ status: 200, description: "Successfully retrieved disputes list" })
  async getDisputes() {
    return this.disputesService.findAll();
  }

  @Patch("disputes/:id/resolve-refund")
  @ApiOperation({ summary: "Resolve dispute in favor of Buyer (Refunds Buyer, penalizes Seller)" })
  @ApiResponse({ status: 200, description: "Dispute resolved, buyer refunded store credits" })
  async resolveRefund(@Param("id") id: string, @Body() resolveDto: ResolveDisputeDto) {
    return this.disputesService.resolveRefund(id, resolveDto.adminNotes);
  }

  @Patch("disputes/:id/resolve-release")
  @ApiOperation({ summary: "Resolve dispute in favor of Seller (Releases held payout escrow to Seller)" })
  @ApiResponse({ status: 200, description: "Dispute resolved, payout released to seller" })
  async resolveRelease(@Param("id") id: string, @Body() resolveDto: ResolveDisputeDto) {
    return this.disputesService.resolveRelease(id, resolveDto.adminNotes);
  }

  // 4. Accounts Suspension
  @Patch("users/:id/suspend")
  @ApiOperation({ summary: "Suspend a user account and freeze access permissions" })
  @ApiResponse({ status: 200, description: "User account suspended" })
  async suspendUser(@Param("id") id: string) {
    return this.adminService.suspendUser(id);
  }

  @Patch("users/:id/activate")
  @ApiOperation({ summary: "Re-activate a suspended user account" })
  @ApiResponse({ status: 200, description: "User account activated" })
  async activateUser(@Param("id") id: string) {
    return this.adminService.activateUser(id);
  }
}
