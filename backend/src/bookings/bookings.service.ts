import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from './booking.entity';
import { Position } from '../positions/position.entity';
import { UsersService } from '../users/users.service';

interface CreateBookingInput extends Partial<Booking> {
  positionCode?: string;
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private repo: Repository<Booking>,
    private usersService: UsersService,
  ) {}

  async create(data: CreateBookingInput) {
    const positionCode = data.position || (data as any).positionCode;
    if (!positionCode) {
      throw new BadRequestException('Position code required');
    }

    const start = data.startAt ? new Date(data.startAt) : null;
    const end = data.endAt ? new Date(data.endAt) : null;
    
    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    
    if (start.getFullYear() < 2020 || start.getFullYear() > 2100 || end.getFullYear() < 2020 || end.getFullYear() > 2100) {
      throw new BadRequestException('Date must be between 2020 and 2100');
    }
    
    if (start >= end) {
      throw new BadRequestException('Start time must be before end time');
    }

    if (start <= new Date()) {
      throw new BadRequestException('Cannot book in the past');
    }

    const posRepo = this.repo.manager.getRepository(Position);
    const pos = await posRepo.findOneBy({ code: positionCode });
    if (!pos) {
      throw new BadRequestException('Position not found');
    }
    const capacity = pos.capacity ?? 1;

    if (data.userVid) {
      const user = await this.usersService.findByVid(data.userVid);
      if (!user) {
        throw new ForbiddenException('User not found');
      }

      // OBS (rating 1) cannot control any position
      if (user.rating <= 1) {
        throw new ForbiddenException('OBS rating cannot book ATC positions. You need at least AS1 (rating 2)');
      }

      const hasRequiredRating = await this.usersService.validateUserRating(
        data.userVid,
        positionCode,
      );
      if (!hasRequiredRating) {
        const requiredRating = await this.usersService.getRequiredRating(positionCode);
        const ratingName = {
          2: 'AS1',
          3: 'AS2',
          4: 'AS3',
          5: 'ADC',
          6: 'APC',
          7: 'ACC',
        }[requiredRating] || `Rating ${requiredRating}`;
        throw new ForbiddenException(
          `Insufficient rating. Position requires ${ratingName} (rating ${requiredRating}) or higher. Your rating: ${user.ratingLevel} (${user.rating})`,
        );
      }
    }

    // Fast overlap check with composite index
    const overlapping = await this.repo.createQueryBuilder('b')
      .where('b.position = :code', { code: positionCode })
      .andWhere('b.startAt < :end', { end: end.toISOString() })
      .andWhere('b.endAt > :start', { start: start.toISOString() })
      .getMany();
    
    if (overlapping.length >= capacity) {
      throw new BadRequestException('Position already booked for this time slot');
    }

    const maxPerUser = Number(process.env.MAX_FUTURE_BOOKINGS_PER_USER || 3);
    if (data.userVid) {
      const userCount = await this.countFutureBookingsForUser(data.userVid);
      if (userCount >= maxPerUser) {
        throw new BadRequestException('Maximum future bookings limit reached');
      }
    }

    const saveData: any = { ...data };
    saveData.position = positionCode;
    if (!saveData.userVid) {
      throw new ForbiddenException('User VID required');
    }
    
    const b = this.repo.create(saveData);
    return this.repo.save(b);
  }

  findAll() {
    return this.repo.find();
  }

  findFuture() {
    const now = new Date().toISOString();
    return this.repo.createQueryBuilder('b')
      .where('b.endAt > :now', { now })
      .orderBy('b.position')
      .getMany();
  }

  async findByDate(dateStr: string) {
    const start = new Date(dateStr + 'T00:00:00Z');
    const end = new Date(dateStr + 'T23:59:59Z');
    return this.repo.createQueryBuilder('b')
      .where('b.startAt <= :end AND b.endAt >= :start', { 
        start: start.toISOString(), 
        end: end.toISOString() 
      })
      .orderBy('b.position')
      .getMany();
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  async remove(id: number) {
    await this.repo.delete(id);
    return { deleted: true };
  }

  async removeOwned(id: number, vid: string | null) {
    const b = await this.repo.findOneBy({ id });
    if (!b) {
      throw new NotFoundException('Booking not found');
    }
    if (!vid || b.userVid !== vid) {
      throw new ForbiddenException('Not authorized to delete this booking');
    }
    await this.repo.delete(id);
    return { deleted: true };
  }

  async update(id: number, data: Partial<Booking>, vid?: string) {
    const b = await this.repo.findOneBy({ id });
    if (!b) {
      throw new NotFoundException('Booking not found');
    }
    if (!vid || b.userVid !== vid) {
      throw new ForbiddenException('Not authorized to update this booking');
    }

    const startStr = (data.startAt ?? b.startAt) as string | null;
    const endStr = (data.endAt ?? b.endAt) as string | null;
    if (!startStr || !endStr) {
      throw new BadRequestException('Start and end times required');
    }
    
    const start = new Date(startStr);
    const end = new Date(endStr);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    
    if (start.getFullYear() < 2020 || start.getFullYear() > 2100 || end.getFullYear() < 2020 || end.getFullYear() > 2100) {
      throw new BadRequestException('Date must be between 2020 and 2100');
    }
    
    if (start >= end) {
      throw new BadRequestException('Start time must be before end time');
    }

    if (start <= new Date()) {
      throw new BadRequestException('Cannot modify booking to start in the past');
    }

    const positionCode = (data.position || b.position) as string;
    const posRepo = this.repo.manager.getRepository(Position);
    const pos = await posRepo.findOneBy({ code: positionCode });
    if (!pos) {
      throw new BadRequestException('Position not found');
    }
    const capacity = pos.capacity ?? 1;

    // Exclude current booking from overlap check
    const overlapping = await this.repo.createQueryBuilder('b')
      .where('b.position = :code', { code: positionCode })
      .andWhere('b.startAt < :end', { end: end.toISOString() })
      .andWhere('b.endAt > :start', { start: start.toISOString() })
      .andWhere('b.id != :id', { id })
      .getMany();

    if (overlapping.length >= capacity) {
      throw new BadRequestException('Position already booked for this time slot');
    }

    Object.assign(b, data);
    return this.repo.save(b);
  }

  async currentOccupant(position: string) {
    const now = new Date().toISOString();
    const q = await this.repo.createQueryBuilder('b')
      .where('b.position = :pos', { pos: position })
      .andWhere('b.startAt <= :now AND b.endAt > :now', { now })
      .getMany();
    return q.map(x => ({ vid: x.userVid, id: x.id, startAt: x.startAt, endAt: x.endAt }));
  }

  async countFutureBookingsForUser(vid: string) {
    const now = new Date().toISOString();
    return this.repo.createQueryBuilder('b').where('b.userVid = :vid AND b.endAt > :now', { vid, now }).getCount();
  }
}

