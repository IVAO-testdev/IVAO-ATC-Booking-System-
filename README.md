# IVAO ATC Booking System

ATC position booking system for IVAO members.

## Quick Start

**Database Setup** (MySQL port 3307):
```sql
CREATE DATABASE atc_booking_db;
```

**Backend**:
```bash
cd backend
cp .env.example .env
# Edit .env with your DB credentials and IVAO API key
npm install
npm start
```

**Frontend**:
```bash
cd frontend
npm install
npm start
```

Access: http://localhost:3000

## Login

**Option 1: OAuth 2.0 (Recommended)**
Click "Login with IVAO" button - redirects to IVAO login page, authenticates with your real account.

**Option 2: Direct VID**
Enter your IVAO VID. The system fetches your member data from IVAO API v2.

## What it does
- List/calendar/timeline views
- Book positions (rating validation)
- Edit/delete bookings
- IVAO API integration (real member data)
- Training/exam modes

Built with NestJS + React + MySQL
