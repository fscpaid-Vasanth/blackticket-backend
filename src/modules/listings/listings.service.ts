import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { CreateListingDto } from "./dto/create-listing.dto";
import { EditListingDto } from "./dto/edit-listing.dto";
import { ListingStatus } from "@prisma/client";

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Create a new movie ticket resale listing
  async create(sellerId: string, createListingDto: CreateListingDto) {
    const { sellingPrice, originalPrice, showtime } = createListingDto;

    // 1. Business Rule: Reseller cannot make a profit!
    if (sellingPrice > originalPrice) {
      throw new BadRequestException(
        "Anti-Scalping Rule: Resale price cannot exceed the original box office price."
      );
    }

    // 2. Validate Showtime is in the future
    const showtimeDate = new Date(showtime);
    if (showtimeDate <= new Date()) {
      throw new BadRequestException("Showtime has already passed. Cannot list expired tickets.");
    }

    // 3. Insert Listing record (Initial status is PENDING for admin verification desk)
    const listing = await this.prisma.listing.create({
      data: {
        ...createListingDto,
        showtime: showtimeDate,
        sellerId,
        status: ListingStatus.PENDING,
      },
    });

    return listing;
  }

  // Browse active resales (filtering out showtimes that have already passed)
  async findAll(city?: string, movieName?: string) {
    const now = new Date();

    return this.prisma.listing.findMany({
      where: {
        status: ListingStatus.ACTIVE,
        showtime: { gt: now }, // Auto-filter expired showtimes
        ...(city && { city }),
        ...(movieName && { movieName: { contains: movieName, mode: "insensitive" } }),
      },
      select: {
        id: true,
        movieName: true,
        theatre: true,
        city: true,
        showtime: true,
        seats: true,
        originalPrice: true,
        sellingPrice: true,
        status: true,
        seller: {
          select: {
            name: true,
            trustScore: true,
          },
        },
      },
      orderBy: {
        showtime: "asc",
      },
    });
  }

  // Get specific resale listing details
  async findOne(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            name: true,
            trustScore: true,
          },
        },
        ticketUpload: {
          select: {
            // Mask filePath / blurred preview helper
            watermarkApplied: true,
            createdAt: true,
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException("Resale listing not found.");
    }

    return listing;
  }

  // Edit an unsold listing
  async update(sellerId: string, id: string, editListingDto: EditListingDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException("Listing not found.");
    }

    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException("Unauthorized. You do not own this listing.");
    }

    if (listing.status === ListingStatus.SOLD) {
      throw new BadRequestException("Listing already sold. Cannot modify ticket details.");
    }

    const originalPrice = editListingDto.originalPrice ?? listing.originalPrice;
    const sellingPrice = editListingDto.sellingPrice ?? listing.sellingPrice;

    if (sellingPrice > originalPrice) {
      throw new BadRequestException("Anti-Scalping Rule: Resale price cannot exceed the original price.");
    }

    return this.prisma.listing.update({
      where: { id },
      data: {
        ...editListingDto,
        showtime: editListingDto.showtime ? new Date(editListingDto.showtime) : undefined,
        status: ListingStatus.PENDING, // Re-trigger Admin review on edits!
      },
    });
  }

  // Delete/Cancel an active, unsold listing
  async remove(sellerId: string, id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException("Listing not found.");
    }

    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException("Unauthorized. You do not own this listing.");
    }

    if (listing.status === ListingStatus.SOLD) {
      throw new BadRequestException("Ticket already purchased by a buyer. Cannot cancel listing.");
    }

    await this.prisma.listing.delete({
      where: { id },
    });

    return { message: "Resale listing successfully removed." };
  }
}
