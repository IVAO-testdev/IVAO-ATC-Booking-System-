import { Controller, Get, Post, Body, Param, Delete, Req, Put, Query, BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { verifyToken } from '../auth/token.util';

const clean = (s: any, max = 500): string => {
  if (typeof s !== 'string') return String(s).slice(0, max);
  return s.slice(0, max).replace(/[<>\"'`]/g, '').trim();
};

function getVidFromReq(req: any) {
  const auth = (req.headers.authorization || '').toString();
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) return null;
  try {
    const obj = verifyToken(m[1]);
    return obj?.vid || null;
  } catch (e) {
    return null;
  }
}

@Controller('bookings')
export class BookingsController {
  constructor(private readonly svc: BookingsService) {}

  @Get()
  listFuture() {
    return this.svc.findFuture();
  }

  @Get('date/:date')
  listByDate(@Param('date') date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Invalid date format (use YYYY-MM-DD)');
    }
    return this.svc.findByDate(date);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    const vid = getVidFromReq(req);
    if (!vid) throw new BadRequestException('Auth required');
    body.userVid = vid;
    body.userName = clean(body.userName || vid);
    body.position = clean(body.position);
    body.notes = clean(body.notes || '');
    body.type = clean(body.type || '');
    return this.svc.create(body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const vid = getVidFromReq(req);
    if (!vid) throw new BadRequestException('Auth required');
    body.position = clean(body.position);
    body.notes = clean(body.notes || '');
    body.type = clean(body.type || '');
    return this.svc.update(Number(id), body, vid);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    const vid = getVidFromReq(req);
    if (!vid) {
      throw new BadRequestException('Authentication required');
    }
    return this.svc.removeOwned(Number(id), vid);
  }

  @Get('occupant')
  occupant(@Query('position') position: string) {
    const p = clean(position);
    if (!p) throw new BadRequestException('Position required');
    return this.svc.currentOccupant(p);
  }
}
