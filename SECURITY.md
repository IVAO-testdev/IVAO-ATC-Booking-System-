# Security Notes

## Dependabot Alerts

The dependency vulnerabilities are in **dev dependencies only**, not production runtime:

**Frontend:**
- `nth-check`, `webpack-dev-server`, `postcss` - only used during `npm start` dev mode
- Production build (`npm run build`) doesn't include these
- Serve the build folder with nginx/apache in production

**Backend:**
- `tar` vulnerability is in typeorm's build chain (sqlite3 optional dependency)
- Doesn't affect runtime, only installation process

## Code Issues Fixed

**SSRF in ivao.service.ts:**
- Added domain whitelist check (only api.ivao.aero allowed)
- Added timeout to prevent hanging requests

**ReDoS in auth/bookings:**
- Replaced regex `/^Bearer\s+(.+)$/` with safer `startsWith()` + `substring()`
- Added token length limit (500 chars max)

## Production Deployment

```bash
# Frontend - build static files
cd frontend
npm run build
# serve 'build/' folder with nginx

# Backend - run compiled version
cd backend
npm start
```

The dev server vulnerabilities don't exist in production builds.
