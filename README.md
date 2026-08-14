69# ServeNep - On-Demand Home Services Platform

> **Nepal's leading on-demand home services marketplace.**  
> Book verified plumbers, electricians, cleaners, and technicians in Kathmandu Valley.

## 🚀 Quick Start Guide

### ⚠️ Important: This is NOT a PHP Project

**XAMPP / WAMP will NOT work** because this is built with:
- **Backend:** NestJS (Node.js) — not PHP
- **Frontend:** Next.js (React) — not PHP
- **Database:** PostgreSQL — not MySQL

You have **two options** to run it:

---

## Option 1: 🐳 Run with Docker (Easiest - Recommended)

This requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed on your system.

```bash
# 1. Clone the repo
git clone https://github.com/lokesh8hatt/servnep.git
cd servnep

# 2. Start everything (backend, frontend, database, cache, nginx)
docker compose up
```

Once running:
- **Website:** http://localhost
- **API:** http://localhost/api/v1
- **API Docs (Swagger):** http://localhost/api/docs

---

## Option 2: 💻 Run Manually (Without Docker)

### Prerequisites

| Tool | Download |
|------|----------|
| **Node.js** (v20+) | https://nodejs.org |
| **PostgreSQL** (v15+) | https://www.postgresql.org/download/ |
| **Redis** (optional) | https://redis.io/download |

### Step 1: Setup PostgreSQL

1. Install PostgreSQL from the link above
2. During installation, set a password (remember it)
3. Open **pgAdmin** or **psql** and create a database:

```sql
CREATE DATABASE servenep;
```

### Step 2: Configure Environment Variables

```bash
# In the backend folder:
cd backend
copy .env.example .env
```

Edit `backend\.env` with your PostgreSQL credentials:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password_here
DATABASE_NAME=servenep
JWT_SECRET=your-super-strong-secret-key-at-least-64-chars
```

### Step 3: Start Backend Server & Seed Demo Data

```bash
cd backend
npm install
npm run start:dev
```

Expected output:
```
ServeNep Backend running on: http://localhost:5000/api/v1
Swagger Docs available on: http://localhost:5000/api/docs
```

In a **separate terminal**, populate the database with the service catalog and demo accounts (safe to re-run — it skips anything already seeded):

```bash
cd backend
npm run seed
```

### Step 4: Start Frontend (New Terminal Window)

```bash
cd frontend
npm install
npm run dev
```

Expected output:
```
▲ Next.js 15.x.x
- Local: http://localhost:3000
```

### Step 5: Open in Browser

| Page | URL |
|------|-----|
| **Homepage** | http://localhost:3000 |
| **Book a Service** | http://localhost:3000/booking |
| **Login** | http://localhost:3000/login |
| **Customer Dashboard** | http://localhost:3000/dashboard/customer |
| **Technician Dashboard** | http://localhost:3000/dashboard/technician |
| **Admin Dashboard** | http://localhost:3000/dashboard/admin |
| **API Docs (Swagger)** | http://localhost:5000/api/docs |

---

## 🔐 How to Login (Testing)

1. Run `npm run seed` in `backend/` first (see Step 3 above) — this creates one demo account per role.
2. Go to http://localhost:3000/login
3. Enter one of the seeded demo phone numbers below (any *new* 10-digit number also works and logs you in as a brand-new Customer)
4. Check the **terminal where backend is running** for the OTP code
5. Enter the OTP to login — you'll be redirected to the correct dashboard based on your role

| Role | Phone Number |
|------|--------------|
| Customer | `9841234567` |
| Technician | `9800000001` |
| Admin | `9800000002` |

---

## 🏗️ Project Structure

```
servnep/
├── backend/               # NestJS API (port 5000)
│   ├── src/
│   │   ├── common/        # Guards, decorators
│   │   ├── config/        # Environment config
│   │   ├── modules/
│   │   │   ├── auth/      # Login, OTP, JWT
│   │   │   ├── bookings/  # Booking CRUD
│   │   │   ├── services/  # Service catalog
│   │   │   ├── users/     # User profiles
│   │   │   ├── payments/  # eSewa, Khalti
│   │   │   └── reviews/   # Ratings & reviews
│   └── database-init.sql  # Database schema
├── frontend/              # Next.js App (port 3000)
│   └── src/
│       ├── app/           # Pages
│       │   ├── login/     # Login page
│       │   ├── booking/   # Booking page
│       │   └── dashboard/ # Customer, Tech, Admin
│       └── context/       # Auth, Guards
├── docker-compose.yml     # Docker setup
└── nginx.conf             # Web server config
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Backend | NestJS 10, TypeORM |
| Database | PostgreSQL 15 |
| Cache | Redis |
| Auth | JWT + OTP (Phone-based) |
| Payments | eSewa, Khalti integration |
| Container | Docker, Docker Compose |
| Web Server | Nginx |

## ✅ Security Features

- Role-Based Access Control (Customer, Technician, Admin, Dispatcher)
- JWT token authentication with 1-hour expiry
- OTP rate limiting (3 requests per 5 minutes)
- Server-side logout with token blacklist
- Input sanitization (XSS prevention)
- HTTPS + HSTS + security headers
- Environment variable validation in production

---

*For questions or support, contact the development team.*