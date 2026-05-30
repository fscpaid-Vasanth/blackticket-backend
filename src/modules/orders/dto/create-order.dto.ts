import { IsNotEmpty, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateOrderDto {
  @ApiProperty({ example: "listing-uuid-123", description: "Listing UUID to purchase" })
  @IsNotEmpty()
  @IsUUID()
  listingId: string;
}
