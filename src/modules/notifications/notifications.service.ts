import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Fetch current user notifications
  async getMyNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  // 2. Mark notification as read
  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found.");
    }

    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  // 3. Mock SMS gateway dispatcher (console logger for zero cost, swap-ready for Twilio or AWS SNS)
  async sendSms(mobile: string, text: string) {
    console.log(`[SMS-MOCK-GATEWAY] Sending SMS to ${mobile}: "${text}"`);
    return { success: true, gateway: "MOCK", messageId: `msg_${Date.now()}` };
  }

  // 4. Mock Email gateway dispatcher (console logger, swap-ready for AWS SES or Nodemailer)
  async sendEmail(email: string, subject: string, text: string) {
    console.log(`[EMAIL-MOCK-GATEWAY] Sending Email to ${email} | Subject: "${subject}" | Content: "${text}"`);
    return { success: true, gateway: "MOCK", messageId: `mail_${Date.now()}` };
  }

  // 5. Create in-app database notification
  async createNotification(userId: string, title: string, message: string, type = "INFO") {
    return this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
      },
    });
  }
}
