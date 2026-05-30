import { Controller, Get, Post, Body, Param, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { DisputesService } from "./disputes.service";
import { RaiseDisputeDto } from "./dto/raise-dispute.dto";
import { JwtAuthGuard } from "../../guards/jwt-auth.guard";

@ApiTags("Disputes & Mediation Queue")
@Controller("disputes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @ApiOperation({ summary: "Raise a dispute and freeze escrow payment (Only by paid Buyer)" })
  @ApiResponse({ status: 201, description: "Dispute registered, escrow holding frozen" })
  async raiseDispute(@Request() req: any, @Body() raiseDisputeDto: RaiseDisputeDto) {
    return this.disputesService.raiseDispute(req.user.id, raiseDisputeDto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Fetch detailed information for a specific dispute case" })
  @ApiResponse({ status: 200, description: "Successfully retrieved dispute details" })
  async findOne(@Param("id") id: string) {
    return this.disputesService.findOne(id);
  }
}
