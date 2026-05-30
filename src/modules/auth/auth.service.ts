import { Injectable, UnauthorizedException, BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma.service";
import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcrypt";
import { Role } from "@prisma/client";

@Injectable()
export class AuthService {
  private readonly logger = new Logger("AuthService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  // Send OTP (Mock SMS Gateway console logs for zero cost)
  async sendOtp(mobile: string): Promise<boolean> {
    const mockOtp = "123456";
    
    this.logger.log(`⚡ [SMS Gateway Mock] Sending OTP code ${mockOtp} to mobile number ${mobile}`);
    console.log(`\n==============================================`);
    console.log(`🔑 [BLACKTICKET OTP CODE] ${mockOtp} -> Send to ${mobile}`);
    console.log(`==============================================\n`);

    // In a live environment, you would store this in Redis with a 5-minute expiration
    // e.g. await this.redis.set(`otp:${mobile}`, mockOtp, 'EX', 300);

    return true;
  }

  // Verify OTP & Sign JWT User Sessions
  async verifyOtp(mobile: string, code: string) {
    // 1. Validate OTP code (Demo accepts 123456)
    if (code !== "123456") {
      throw new BadRequestException("Invalid or expired OTP code. Use standard demo code: 123456");
    }

    // Normalize phone formatting
    const normalizedMobile = mobile.trim();

    // 2. Fetch User or Autoregister (Buyer role by default for onboarding)
    let user = await this.prisma.user.findUnique({
      where: { mobile: normalizedMobile },
    });

    if (!user) {
      this.logger.log(`👤 Mobile ${normalizedMobile} not registered. Autoregistering as Buyer.`);
      
      const salt = await bcrypt.genSalt(10);
      const defaultHash = await bcrypt.hash("123456", salt);

      // Create new user & wallet
      user = await this.prisma.user.create({
        data: {
          name: normalizedMobile.includes("9999988888") ? "Google User" : `User_${mobile.slice(-4)}`,
          mobile: normalizedMobile,
          password: defaultHash,
          city: "Bengaluru",
          role: Role.BUYER,
          trustScore: 100,
        },
      });

      await this.prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 1000.0, // Free welcome credits!
          escrowBalance: 0,
        },
      });
    }

    if (user.status === "SUSPENDED") {
      throw new UnauthorizedException("Your BlackTicket profile has been suspended by an Admin.");
    }

    // 3. Issue JWT Access & Refresh tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        role: user.role,
        trustScore: user.trustScore,
      },
    };
  }

  // Generate short-lived Access token
  private generateAccessToken(user: any): string {
    const secret = this.configService.get<string>("jwt.secret") || "blackticket_secret_jwt_key_mvp_99";
    const expiresIn = this.configService.get<string>("jwt.expiresIn") || "1h";
    return jwt.sign(
      {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
      },
      secret,
      { expiresIn: expiresIn as any }
    );
  }

  // Generate long-lived Refresh token
  private generateRefreshToken(user: any): string {
    const secret = this.configService.get<string>("jwt.refreshSecret") || "blackticket_refresh_jwt_key_mvp_99";
    const expiresIn = this.configService.get<string>("jwt.refreshExpiresIn") || "7d";
    return jwt.sign(
      {
        id: user.id,
      },
      secret,
      { expiresIn: expiresIn as any }
    );
  }

  // Refresh Session access token
  async refreshSession(refreshTokenString: string) {
    try {
      const secret = this.configService.get<string>("jwt.refreshSecret");
      const decoded = jwt.verify(refreshTokenString, secret) as any;

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user || user.status === "SUSPENDED") {
        throw new UnauthorizedException("Invalid session context or user suspended.");
      }

      const accessToken = this.generateAccessToken(user);
      return { accessToken };
    } catch (err) {
      throw new UnauthorizedException("Session refresh token expired or signature invalid.");
    }
  }
}
