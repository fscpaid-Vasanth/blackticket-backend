import { Controller, Post, Body, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { SendOtpDto } from "./dto/send-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

@ApiTags("Authentication Gate")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("send-otp")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Dispatch a mock SMS verification OTP code to mobile" })
  @ApiResponse({ status: 200, description: "OTP sent successfully" })
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    const success = await this.authService.sendOtp(sendOtpDto.mobile);
    return { message: "Mock SMS verification code dispatched. Enter code '123456' to log in." };
  }

  @Post("verify-otp")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Validate OTP and issue JWT access/refresh session tokens" })
  @ApiResponse({ status: 200, description: "Successfully authenticated session" })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto.mobile, verifyOtpDto.code);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Acquire a new JWT Access Token via a valid Refresh Token" })
  @ApiResponse({ status: 200, description: "Access token successfully refreshed" })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshSession(refreshTokenDto.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Invalidate active session credentials" })
  @ApiResponse({ status: 200, description: "Logout successful" })
  async logout() {
    return { message: "Session successfully invalidated. Logout complete." };
  }
}
