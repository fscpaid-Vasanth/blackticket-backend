import { Controller, Get, Patch, Param, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../../guards/jwt-auth.guard";

@ApiTags("In-App Notifications Desk")
@Controller("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "Get in-app notification history logs (limited to 50)" })
  @ApiResponse({ status: 200, description: "Successfully retrieved notifications list" })
  async getMyNotifications(@Request() req: any) {
    return this.notificationsService.getMyNotifications(req.user.id);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark specific notification as read status" })
  @ApiResponse({ status: 200, description: "Notification successfully updated to read" })
  async markAsRead(@Request() req: any, @Param("id") id: string) {
    return this.notificationsService.markAsRead(req.user.id, id);
  }
}
