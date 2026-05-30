import { Controller, Get, Post, Body, Param, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { JwtAuthGuard } from "../../guards/jwt-auth.guard";

@ApiTags("Ticket Resale Orders")
@Controller("orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: "Create a new ticket purchase order (Initial status: PENDING)" })
  @ApiResponse({ status: 201, description: "Purchase order created, awaiting payment verification" })
  async create(@Request() req: any, @Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(req.user.id, createOrderDto);
  }

  @Get("my")
  @ApiOperation({ summary: "Get current buyer's order history" })
  @ApiResponse({ status: 200, description: "Successfully retrieved order list" })
  async findMyOrders(@Request() req: any) {
    return this.ordersService.findMyOrders(req.user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Fetch detailed information for a specific order" })
  @ApiResponse({ status: 200, description: "Successfully retrieved order details" })
  async findOne(@Request() req: any, @Param("id") id: string) {
    return this.ordersService.findOne(req.user.id, id);
  }
}
