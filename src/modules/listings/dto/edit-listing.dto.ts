import { IsOptional, IsString, IsNumber, IsArray, IsDateString, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class EditListingDto {
  @ApiProperty({ example: "Leo (IMAX Tamil)", description: "Movie Title and format", required: false })
  @IsOptional()
  @IsString()
  movieName?: string;

  @ApiProperty({ example: "Sathyam Cinemas (SPI)", description: "Theatre name", required: false })
  @IsOptional()
  @IsString()
  theatre?: string;

  @ApiProperty({ example: "2026-05-26T19:30:00Z", description: "ISO Date String of Showtime", required: false })
  @IsOptional()
  @IsDateString()
  showtime?: string;

  @ApiProperty({ example: ["H-12", "H-13"], description: "List of Seat Numbers", required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seats?: string[];

  @ApiProperty({ example: 480.0, description: "Original ticket box office price", required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  originalPrice?: number;

  @ApiProperty({ example: 315.0, description: "Discounted selling price", required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;
}
