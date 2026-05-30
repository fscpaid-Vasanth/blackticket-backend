# BlackTicket Backend — MVP API

> Secure, cost-optimized movie ticket resale marketplace backend.  
> Built with **NestJS · TypeScript · PostgreSQL (Prisma) · Redis (BullMQ) · AWS S3 · Razorpay**

---

## Stack

| Layer | Technology |
|---|---|
| Framework | NestJS (Node.js) |
| Language | TypeScript |
| Database | PostgreSQL via Supabase (Prisma ORM) |
| Cache / Queue | Redis via Upstash (BullMQ) |
| File Storage | AWS S3 |
| Payments | Razorpay |
| Auth | JWT (OTP-based login) |

---

## Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Start local PostgreSQL + Redis
docker compose up -d

# 3. Copy env and fill in your credentials
cp .env.example .env

# 4. Push schema to DB
npx prisma db push

# 5. Seed demo data
npx ts-node prisma/seed.ts

# 6. Start dev server
npm run start:dev
```

API runs at **http://localhost:3000**  
Swagger docs at **http://localhost:3000/api-docs**

---

## Environment Variables

Copy `.env.example` → `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase transaction pooler URL |
| `DIRECT_URL` | ✅ | Supabase session pooler (migrations) |
| `REDIS_URL` | ✅ | Upstash Redis `rediss://` URL |
| `JWT_SECRET` | ✅ | 64-byte secret |
| `RAZORPAY_KEY_ID` | ✅ | Razorpay key |
| `RAZORPAY_KEY_SECRET` | ✅ | Razorpay secret |
| `AWS_ACCESS_KEY_ID` | ✅ | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | ✅ | IAM secret key |
| `AWS_REGION` | ✅ | e.g. `ap-south-1` |
| `AWS_S3_BUCKET` | ✅ | S3 bucket name |

---

## API Modules

| Module | Routes | Description |
|---|---|---|
| Auth | `/auth/*` | OTP login, JWT tokens |
| Users | `/users/*` | Profile management |
| Listings | `/listings/*` | Resale listings CRUD |
| Tickets | `/tickets/*` | S3 upload + signed URL reveal |
| Orders | `/orders/*` | Purchase orders |
| Payments | `/payments/*` | Razorpay checkout + verification |
| Escrow | Internal | Delayed payout release via BullMQ |
| Wallet | `/wallet/*` | Balance + IMPS withdrawals |
| Disputes | `/disputes/*` | Conflict mediation |
| Notifications | `/notifications/*` | In-app alerts |
| Admin | `/admin/*` | Moderation desk (ADMIN role only) |

---

## Deployment

### Railway (Recommended)
```bash
npm install -g @railway/cli
railway login && railway init
railway variables set DATABASE_URL="..." REDIS_URL="..." # etc.
railway up
```

Build command: `npm run build:prod`  
Start command: `npm run start:prod`

### Docker
```bash
docker build -t blackticket-backend .
docker run -d -p 3000:3000 --env-file .env blackticket-backend
```

---

## License

Private & Confidential — BlackTicket © 2026
