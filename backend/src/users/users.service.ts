import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

const RATING_LEVELS: { [key: number]: string } = {
  0: 'NO_RATING',
  1: 'OBS',
  2: 'AS1',
  3: 'AS2',
  4: 'AS3',
  5: 'ADC',
  6: 'APC',
  7: 'ACC',
  8: 'SEC',
  9: 'SAI',
  10: 'CAI',
  11: 'SUP',
  12: 'ADM',
};

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultUser();
  }

  private async seedDefaultUser() {
    const existingUser = await this.repo.findOneBy({ vid: '000000' });
    if (!existingUser) {
      const defaultUser = this.repo.create({
        vid: '000000',
        name: 'Test User',
        email: 'test@ivao.aero',
        rating: 4,
        ratingLevel: 'ADC',
        countryId: 'KR',
        divisionId: 'XE',
      });
      await this.repo.save(defaultUser);
    }
  }

  async createUser(userData: {
    vid: string;
    name?: string;
    email?: string;
    rating: number;
    ratingLevel?: string;
    divisionId?: string;
    countryId?: string;
  }): Promise<User> {
    const ratingLevel = userData.ratingLevel || RATING_LEVELS[userData.rating] || 'NO_RATING';

    let user = await this.repo.findOneBy({ vid: userData.vid });

    if (user) {
      const ratingChanged = user.rating !== userData.rating;
      user.name = userData.name || user.name;
      user.email = userData.email || user.email;
      user.rating = userData.rating;
      user.ratingLevel = ratingLevel;
      user.divisionId = userData.divisionId || user.divisionId;
      user.countryId = userData.countryId || user.countryId;
      user.updatedAt = new Date();
      if (ratingChanged) {
        user.lastRatingUpdate = new Date();
      }
    } else {
      user = this.repo.create({
        vid: userData.vid,
        name: userData.name || userData.vid,
        email: userData.email,
        rating: userData.rating,
        ratingLevel,
        divisionId: userData.divisionId,
        countryId: userData.countryId,
      });
    }

    await this.repo.save(user);
    return user;
  }

  async findByVid(vid: string): Promise<User | null> {
    return this.repo.findOneBy({ vid });
  }

  async getRequiredRating(positionCode: string): Promise<number> {
    const posRepo = this.repo.manager.getRepository('Position');
    const position = await posRepo.findOneBy({ code: positionCode });
    
    if (position && position.requiredRating) {
      return position.requiredRating;
    }
    
    // Fallback if position not found
    const complexPatterns = ['APP', 'CTR', 'FSS'];
    const busyPatterns = ['KJFK', 'KLAX', 'EGLL', 'LFPG', 'RJTT', 'RKSI', 'VHHH', 'WSSS'];

    const isBusy = busyPatterns.some(p => positionCode.includes(p));
    const isComplex = complexPatterns.some(p => positionCode.includes(p));

    if (isComplex && isBusy) return 5;
    if (isComplex) return 5;
    if (isBusy) return 3;
    return 2;
  }

  async validateUserRating(vid: string, positionCode: string): Promise<boolean> {
    const user = await this.findByVid(vid);
    if (!user) return false;

    // OBS (rating 1) cannot control any position
    if (user.rating <= 1) return false;

    const requiredRating = await this.getRequiredRating(positionCode);
    return user.rating >= requiredRating;
  }

  async getAllUsers(): Promise<User[]> {
    return this.repo.find({ order: { vid: 'ASC' } });
  }
}

