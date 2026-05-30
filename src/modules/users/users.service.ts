import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Fetch complete profile details (including wallet)
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallet: {
          select: {
            balance: true,
            escrowBalance: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("Profile not found");
    }

    // Exclude password hash from payload
    const { password, ...safeUser } = user;
    return safeUser;
  }

  // Update profile details
  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateProfileDto,
    });

    const { password, ...safeUser } = user;
    return safeUser;
  }
}
