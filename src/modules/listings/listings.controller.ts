import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { ListingsService } from "./listings.service";
import { CreateListingDto } from "./dto/create-listing.dto";
import { EditListingDto } from "./dto/edit-listing.dto";
import { JwtAuthGuard } from "../../guards/jwt-auth.guard";

@ApiTags("Ticket Resale Listings")
@Controller("listings")
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  @ApiOperation({ summary: "Browse all active, unsold movie ticket resales in a city" })
  @ApiQuery({ name: "city", required: false, example: "Chennai" })
  @ApiQuery({ name: "movieName", required: false, example: "Leo" })
  @ApiResponse({ status: 200, description: "Successfully retrieved resales grid" })
  async findAll(@Query("city") city?: string, @Query("movieName") movieName?: string) {
    return this.listingsService.findAll(city, movieName);
  }

  @Get(":id")
  @ApiOperation({ summary: "Fetch detailed information for a specific resale ticket" })
  @ApiResponse({ status: 200, description: "Successfully retrieved listing details" })
  async findOne(@Param("id") id: string) {
    return this.listingsService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List an unused movie ticket for resale (Initial status: PENDING)" })
  @ApiResponse({ status: 201, description: "Resale listing registered under moderation desk" })
  async create(@Request() req: any, @Body() createListingDto: CreateListingDto) {
    return this.listingsService.create(req.user.id, createListingDto);
  }

  @Patch(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Modify details of an unsold resale listing" })
  @ApiResponse({ status: 200, description: "Listing details successfully updated" })
  async update(
    @Request() req: any,
    @Param("id") id: string,
    @Body() editListingDto: EditListingDto
  ) {
    return this.listingsService.update(req.user.id, id, editListingDto);
  }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Cancel and delete an active, unsold resale listing" })
  @ApiResponse({ status: 200, description: "Listing successfully deleted" })
  async remove(@Request() req: any, @Param("id") id: string) {
    return this.listingsService.remove(req.user.id, id);
  }
}
