# Riciti

Invoice & Receipt Generator for the Kenyan market. Guest-first SaaS with M-Pesa payment integration.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (Supabase/Neon)
- **ORM**: Prisma
- **State**: Zustand
- **Payments**: Safaricom Daraja API (M-Pesa STK Push)

## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/RomanBenjamin/riciti.git
cd riciti
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string (with pgbouncer)
- `DIRECT_URL` - Direct PostgreSQL connection (for migrations)

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (development)
npm run db:push

# Or run migrations (production)
npm run db:migrate

# View data in Prisma Studio
npm run db:studio
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## API Routes

### Invoice CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List invoices (tenant-scoped) |
| POST | `/api/invoices` | Create invoice |
| GET | `/api/invoices/[id]` | Get invoice by ID |
| PUT | `/api/invoices/[id]` | Update invoice |
| DELETE | `/api/invoices/[id]` | Delete invoice |
| GET | `/api/invoices/public/[publicId]` | Get invoice by public link |
| GET | `/api/invoices/public/[publicId]/status` | Check payment status |

### Multi-Tenant Data Isolation

- **Authenticated users**: Queries filter by `userId`
- **Guest users**: Queries filter by `guestSessionId` (cookie-based)
- **Public links**: Read-only access via non-guessable `publicId`

## Database Schema

See [prisma/schema.prisma](prisma/schema.prisma) for full schema.

Core models:
- `User` - Registered users (optional)
- `Invoice` - Invoice documents with multi-tenant fields
- `LineItem` - Invoice line items
- `Payment` - M-Pesa payment records

## Next Steps

- [ ] M-Pesa STK Push integration
- [ ] PDF generation with `@react-pdf/renderer`
- [ ] Authentication (Clerk/NextAuth)
- [ ] User dashboard