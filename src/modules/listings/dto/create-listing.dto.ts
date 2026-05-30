import { IsNotEmpty, IsString, IsNumber, IsArray, IsDateString, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateListingDto {
  @ApiProperty({ example: "Leo (IMAX Tamil)", description: "Movie Title and format" })
  @IsNotEmpty()
  @IsString()
  movieName: string;

  @ApiProperty({ example: "Sathyam Cinemas (SPI)", description: "Theatre name" })
  @IsNotEmpty()
  @IsString()
  theatre: string;

  @ApiProperty({ example: "Chennai", description: "City name" })
  @IsNotEmpty()
  @IsString()
  city: string;

  @ApiProperty({ example: "2026-05-26T19:30:00Z", description: "ISO Date String of Showtime" })
  @IsNotEmpty()
  @IsDateString()
  showtime: string;

  @ApiProperty({ example: ["H-12", "H-13"], description: "List of Seat Numbers" })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  seats: string[];

  @ApiProperty({ example: 480.0, description: "Original ticket box office price" })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  originalPrice: number;

  @ApiProperty({ example: 315.0, description: "Discounted selling price" })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  sellingPrice: number;
}
