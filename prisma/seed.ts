import { PrismaClient, Role, ListingStatus, EscrowStatus, OrderStatus, PaymentStatus, TransactionType } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Database Seeding...");

  // Clear existing records
  await prisma.accessLog.deleteMany({});
  await prisma.dispute.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.escrow.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.ticketUpload.deleteMany({});
  await prisma.listing.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.withdrawRequest.deleteMany({});
  await prisma.wallet.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("🧹 Cleared old mock database records.");

  // Password hashes
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash("123456", salt);

  // 1. Create Users
  const buyer = await prisma.user.create({
    data: {
      name: "Ramesh Kumar",
      email: "ramesh.kumar@gmail.com",
      mobile: "+91 98765 43210",
      password: hashedPassword,
      city: "Bengaluru",
      role: Role.BUYER,
      trustScore: 100,
    },
  });

  const seller = await prisma.user.create({
    data: {
      name: "Suresh Raina",
      email: "suresh.raina@gmail.com",
      mobile: "+91 87654 32109",
      password: hashedPassword,
      city: "Chennai",
      role: Role.SELLER,
      trustScore: 98,
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: "Vikram Rathore",
      email: "vikram.admin@blackticket.com",
      mobile: "+91 76543 21098",
      password: hashedPassword,
      city: "Bengaluru",
      role: Role.ADMIN,
      trustScore: 100,
    },
  });

  console.log("👤 Seeded Ramesh (Buyer), Suresh (Seller), and Vikram (Admin) accounts.");

  // 2. Create Wallets
  await prisma.wallet.create({
    data: {
      userId: buyer.id,
      balance: 1500,
      escrowBalance: 0,
    },
  });

  const sellerWallet = await prisma.wallet.create({
    data: {
      userId: seller.id,
      balance: 850,
      escrowBalance: 315, // Active escrow hold
    },
  });

  await prisma.wallet.create({
    data: {
      userId: admin.id,
      balance: 10000,
      escrowBalance: 0,
    },
  });

  console.log("💰 Seeded wallets for Ramesh, Suresh, and Vikram.");

  // 3. Create Sample Listings
  const showtime1 = new Date();
  showtime1.setHours(showtime1.getHours() + 3); // in 3 hours

  const showtime2 = new Date();
  showtime2.setHours(showtime2.getHours() + 6); // in 6 hours

  const listing1 = await prisma.listing.create({
    data: {
      movieName: "Leo (IMAX Tamil)",
      theatre: "Sathyam Cinemas (SPI)",
      city: "Chennai",
      showtime: showtime1,
      seats: ["H-12", "H-13"],
      originalPrice: 480.0,
      sellingPrice: 315.0,
      status: ListingStatus.ACTIVE,
      sellerId: seller.id,
    },
  });

  const listing2 = await prisma.listing.create({
    data: {
      movieName: "Jailer (2D Kannada)",
      theatre: "PVR Vega City IMAX",
      city: "Bengaluru",
      showtime: showtime2,
      seats: ["C-04", "C-05", "C-06"],
      originalPrice: 750.0,
      sellingPrice: 450.0,
      status: ListingStatus.PENDING, // Pending approval
      sellerId: seller.id,
    },
  });

  console.log("🎟️ Seeded Active 'Leo' listing and Pending 'Jailer' listing.");

  // 4. Create Ticket Upload for listing1
  const ticketUpload = await prisma.ticketUpload.create({
    data: {
      listingId: listing1.id,
      filePath: "tickets/leo_sathyam_h12_h13_mock.pdf",
      fileSize: 1048576, // 1MB
      mimeType: "application/pdf",
      watermarkApplied: false,
    },
  });

  console.log("📂 Seeded masked ticket upload PDF registry for Leo.");

  // 5. Create Order and Escrow Payment
  const order = await prisma.order.create({
    data: {
      listingId: listing1.id,
      buyerId: buyer.id,
      amount: 315.0,
      status: OrderStatus.PAID,
    },
  });

  await prisma.payment.create({
    data: {
      orderId: order.id,
      razorpayOrderId: "order_mock_razorpay_leo_99",
      razorpayPaymentId: "pay_mock_razorpay_payment_99",
      amount: 315.0,
      status: PaymentStatus.SUCCESS,
    },
  });

  const releaseTime = new Date(showtime1);
  releaseTime.setMinutes(releaseTime.getMinutes() + 30); // Showtime + 30 minutes

  await prisma.escrow.create({
    data: {
      orderId: order.id,
      amount: 315.0,
      status: EscrowStatus.ACTIVE,
      releaseAt: releaseTime,
    },
  });

  // Seed Seller Ledger transaction for escrow hold
  await prisma.transaction.create({
    data: {
      walletId: sellerWallet.id,
      amount: 315.0,
      type: TransactionType.ESCROW_HOLD,
      description: "Escrow payment hold from Ramesh Kumar for 'Leo' tickets",
    },
  });

  console.log("🛡️ Seeded order, payment validation, and escrow holds for Ramesh's Leo purchase.");

  // 6. Seed Sample System Notifications
  await prisma.notification.create({
    data: {
      userId: buyer.id,
      title: "Payment Confirmed",
      message: "Your payment of ₹315 for 'Leo' is held in escrow. Payout releases 30 mins after showtime.",
      type: "SUCCESS",
    },
  });

  await prisma.notification.create({
    data: {
      userId: seller.id,
      title: "Ticket Sold!",
      message: "Your tickets for 'Leo' are sold! ₹315 is secured in escrow and will credit your wallet post-showtime.",
      type: "SUCCESS",
    },
  });

  console.log("🌱 Database Seeding Completed Successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed with error: ", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
