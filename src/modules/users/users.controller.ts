import { Controller, Get, Patch, Body, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { JwtAuthGuard } from "../../guards/jwt-auth.guard";

@ApiTags("User Profiles Desk")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "Fetch current logged-in user profile detail" })
  @ApiResponse({ status: 200, description: "Successfully retrieved profile" })
  async getProfile(@Request() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Patch("me")
  @ApiOperation({ summary: "Update current logged-in user profile detail" })
  @ApiResponse({ status: 200, description: "Successfully updated profile" })
  async updateProfile(@Request() req: any, @Body() updateProfileDto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, updateProfileDto);
  }
}
