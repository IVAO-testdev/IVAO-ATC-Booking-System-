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

Enter your real IVAO VID to log in. The system fetches your actual member data (rating, division, country) from IVAO API v2 automatically.

## Authentication Design Choice

The exercise suggests sending VID as a plain HTTP header with the assumption that "end-user can't forge headers". However, in reality, browser DevTools allow easy header manipulation, enabling users to impersonate others.

I chose signed Bearer tokens (HMAC-SHA256) instead because:
- Prevents impersonation attacks (exercise requires "prevent users impersonating other users")
- Still simple to implement (single token.util.ts file)
- Industry standard approach
- Minimal overhead while providing real security

The exercise states "if you have a better idea, we are open to it" - this is that idea.

## What it does
- List/calendar/timeline views
- Book positions (rating validation)
- Edit/delete bookings
- IVAO API integration (real member data)
- Training/exam modes

Built with NestJS + React + MySQL
