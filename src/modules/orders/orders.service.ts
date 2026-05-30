import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ListingStatus, OrderStatus } from "@prisma/client";

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // Create a new ticket purchase order (Initial status: PENDING)
  async create(buyerId: string, createOrderDto: CreateOrderDto) {
    const { listingId } = createOrderDto;

    // 1. Fetch listing details
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException("Resale listing not found.");
    }

    // 2. Validate Listing Status is ACTIVE (meaning approved by admin)
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException("Listing is currently unavailable or pending moderator approval.");
    }

    // 3. Business Rule: Seller cannot buy their own tickets!
    if (listing.sellerId === buyerId) {
      throw new BadRequestException("Anti-Scalping Rule: You cannot purchase your own resale listing.");
    }

    // 4. Validate Showtime has not passed
    if (new Date(listing.showtime) <= new Date()) {
      throw new BadRequestException("Showtime has already passed. Ticket resale expired.");
    }

    // 5. Ensure listing has not been sold already
    const existingPaidOrder = await this.prisma.order.findFirst({
      where: {
        listingId,
        status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
      },
    });

    if (existingPaidOrder) {
      throw new BadRequestException("This ticket listing has already been sold to another buyer.");
    }

    // 6. Automatically clean up older pending orders for the same listing by the same buyer
    await this.prisma.order.updateMany({
      where: {
        listingId,
        buyerId,
        status: OrderStatus.PENDING,
      },
      data: {
        status: OrderStatus.REFUNDED, // Mark as canceled
      },
    });

    // 7. Create new Order in PENDING status
    const order = await this.prisma.order.create({
      data: {
        listingId,
        buyerId,
        amount: listing.sellingPrice,
        status: OrderStatus.PENDING,
      },
      include: {
        listing: {
          select: {
            movieName: true,
            theatre: true,
            showtime: true,
            seats: true,
          },
        },
      },
    });

    return order;
  }

  // Get specific order details
  async findOne(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        buyerId,
      },
      include: {
        listing: true,
        payment: true,
        escrow: true,
        dispute: true,
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found or restricted.");
    }

    return order;
  }

  // Get current buyer's order history
  async findMyOrders(buyerId: string) {
    return this.prisma.order.findMany({
      where: { buyerId },
      include: {
        listing: {
          select: {
            movieName: true,
            theatre: true,
            showtime: true,
            seats: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}
