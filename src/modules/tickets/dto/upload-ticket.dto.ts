import { IsNotEmpty, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UploadTicketDto {
  @ApiProperty({ example: "listing-uuid-123", description: "Target resale listing UUID" })
  @IsNotEmpty()
  @IsUUID()
  listingId: string;
}
