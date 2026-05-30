import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  Headers,
  Query,
  Ip,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { TicketsService } from "./tickets.service";
import { JwtAuthGuard } from "../../guards/jwt-auth.guard";
import { AccessAction } from "@prisma/client";

@ApiTags("Ticket Security & Watermarks")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("tickets")
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post(":listingId/upload")
  @ApiOperation({ summary: "Upload scannable PDF/Image ticket to AWS S3 (sellers only)" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "Ticket PDF or image file (max 10 MB)",
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: "Ticket file securely uploaded to AWS S3" })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),                       // keep file in RAM → pipe straight to S3
      limits: { fileSize: 10 * 1024 * 1024 },        // 10 MB max
      fileFilter: (_req, file, cb) => {
        const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException("Only PDF, JPEG, PNG, or WEBP files are accepted."), false);
        }
      },
    })
  )
  async uploadTicket(
    @Request() req: any,
    @Param("listingId") listingId: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException("No file attached. Please upload a ticket file.");
    }
    return this.ticketsService.uploadTicket(req.user.id, listingId, file);
  }

  @Get(":listingId/reveal")
  @ApiOperation({ summary: "Reveal unmasked ticket with pre-signed S3 URL and security watermark (buyers only)" })
  @ApiQuery({ name: "action", required: false, enum: ["VIEW", "DOWNLOAD"], example: "VIEW" })
  @ApiResponse({ status: 200, description: "Ticket unlocked — pre-signed S3 download URL returned" })
  async revealTicket(
    @Request() req: any,
    @Param("listingId") listingId: string,
    @Headers("user-agent") userAgent: string,
    @Ip() ipAddress: string,
    @Query("action") action?: AccessAction
  ) {
    const actionType = action === AccessAction.DOWNLOAD ? AccessAction.DOWNLOAD : AccessAction.VIEW;
    return this.ticketsService.revealTicket(
      req.user.id,
      listingId,
      userAgent || "Mozilla/5.0 Reseller-Agent",
      ipAddress || "127.0.0.1",
      actionType
    );
  }
}
