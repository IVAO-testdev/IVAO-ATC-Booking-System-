import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position } from './position.entity';

@Injectable()
export class PositionsService implements OnModuleInit {
  private readonly logger = new Logger(PositionsService.name);
  private positionsCache: Position[] | null = null;
  private cacheTime: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 min

  constructor(
    @InjectRepository(Position)
    private repo: Repository<Position>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultPositions();
    // Invalidate cache after seeding
    this.positionsCache = null;
  }

  private async seedDefaultPositions() {
    const defaultPositions = [
      { code: 'RKSS_DEL', name: 'Seoul Gimpo Delivery', capacity: 1, role: 'DEL', division: 'XE', requiredRating: 1 },
      { code: 'RKSS_GND', name: 'Seoul Gimpo Ground', capacity: 1, role: 'GND', division: 'XE', requiredRating: 2 },
      { code: 'RKSS_TWR', name: 'Seoul Gimpo Tower', capacity: 1, role: 'TWR', division: 'XE', requiredRating: 4 },
      { code: 'RKSS_APP', name: 'Seoul Gimpo Approach', capacity: 1, role: 'APP', division: 'XE', requiredRating: 5 },
      
      { code: 'RKSI_DEL', name: 'Seoul Incheon Delivery', capacity: 1, role: 'DEL', division: 'XE', requiredRating: 2 },
      { code: 'RKSI_GND', name: 'Seoul Incheon Ground', capacity: 1, role: 'GND', division: 'XE', requiredRating: 3 },
      { code: 'RKSI_TWR', name: 'Seoul Incheon Tower', capacity: 1, role: 'TWR', division: 'XE', requiredRating: 4 },
      { code: 'RKSI_APP', name: 'Incheon Approach', capacity: 1, role: 'APP', division: 'XE', requiredRating: 5 },
      { code: 'RKSI_CTR', name: 'Incheon Control', capacity: 1, role: 'CTR', division: 'XE', requiredRating: 6 },
      
      { code: 'RKPC_GND', name: 'Jeju Ground', capacity: 1, role: 'GND', division: 'XE', requiredRating: 2 },
      { code: 'RKPC_TWR', name: 'Jeju Tower', capacity: 1, role: 'TWR', division: 'XE', requiredRating: 4 },
      { code: 'RKPC_APP', name: 'Jeju Approach', capacity: 1, role: 'APP', division: 'XE', requiredRating: 5 },
      
      { code: 'RKPK_GND', name: 'Busan Ground', capacity: 1, role: 'GND', division: 'XE', requiredRating: 2 },
      { code: 'RKPK_TWR', name: 'Busan Gimhae Tower', capacity: 1, role: 'TWR', division: 'XE', requiredRating: 4 },
      { code: 'RKPK_APP', name: 'Busan Approach', capacity: 1, role: 'APP', division: 'XE', requiredRating: 5 },
      
      { code: 'RKTN_TWR', name: 'Daegu Tower', capacity: 1, role: 'TWR', division: 'XE', requiredRating: 4 },
      { code: 'RKJJ_TWR', name: 'Gwangju Tower', capacity: 1, role: 'TWR', division: 'XE', requiredRating: 4 },
      { code: 'RKNY_TWR', name: 'Yangyang Tower', capacity: 1, role: 'TWR', division: 'XE', requiredRating: 4 },
      
      { code: 'RJTT_GND', name: 'Tokyo Haneda Ground', capacity: 1, role: 'GND', division: 'JP', requiredRating: 3 },
      { code: 'RJTT_TWR', name: 'Tokyo Haneda Tower', capacity: 1, role: 'TWR', division: 'JP', requiredRating: 4 },
      { code: 'RJTT_APP', name: 'Tokyo Approach', capacity: 1, role: 'APP', division: 'JP', requiredRating: 5 },
      { code: 'RJAA_TWR', name: 'Tokyo Narita Tower', capacity: 1, role: 'TWR', division: 'JP', requiredRating: 4 },
      { code: 'RJBB_TWR', name: 'Osaka Kansai Tower', capacity: 1, role: 'TWR', division: 'JP', requiredRating: 4 },
      { code: 'RJBB_APP', name: 'Osaka Approach', capacity: 1, role: 'APP', division: 'JP', requiredRating: 5 },
      
      { code: 'VHHH_GND', name: 'Hong Kong Ground', capacity: 1, role: 'GND', division: 'HK', requiredRating: 2 },
      { code: 'VHHH_TWR', name: 'Hong Kong Tower', capacity: 1, role: 'TWR', division: 'HK', requiredRating: 4 },
      { code: 'VHHH_APP', name: 'Hong Kong Approach', capacity: 1, role: 'APP', division: 'HK', requiredRating: 5 },
      
      { code: 'WSSS_GND', name: 'Singapore Changi Ground', capacity: 1, role: 'GND', division: 'SO', requiredRating: 2 },
      { code: 'WSSS_TWR', name: 'Singapore Changi Tower', capacity: 1, role: 'TWR', division: 'SO', requiredRating: 4 },
      { code: 'WSSS_APP', name: 'Singapore Approach', capacity: 1, role: 'APP', division: 'SO', requiredRating: 5 },
      
      { code: 'KJFK_GND', name: 'New York JFK Ground', capacity: 1, role: 'GND', division: 'US', requiredRating: 3 },
      { code: 'KJFK_TWR', name: 'New York JFK Tower', capacity: 1, role: 'TWR', division: 'US', requiredRating: 4 },
      { code: 'KLAX_TWR', name: 'Los Angeles Tower', capacity: 1, role: 'TWR', division: 'US', requiredRating: 4 },
      { code: 'KSFO_TWR', name: 'San Francisco Tower', capacity: 1, role: 'TWR', division: 'US', requiredRating: 4 },
      
      { code: 'EGLL_GND', name: 'London Heathrow Ground', capacity: 1, role: 'GND', division: 'EU', requiredRating: 3 },
      { code: 'EGLL_TWR', name: 'London Heathrow Tower', capacity: 1, role: 'TWR', division: 'EU', requiredRating: 4 },
      { code: 'LFPG_TWR', name: 'Paris CDG Tower', capacity: 1, role: 'TWR', division: 'EU', requiredRating: 4 },
      { code: 'EDDF_TWR', name: 'Frankfurt Tower', capacity: 1, role: 'TWR', division: 'EU', requiredRating: 4 },
    ];
    for (const pos of defaultPositions) {
      const existing = await this.repo.findOneBy({ code: pos.code });
      if (existing) {
        Object.assign(existing, pos);
        await this.repo.save(existing);
      } else {
        await this.repo.save(this.repo.create(pos));
      }
    }
  }

  async findAll() {
    // 5min cache for position list
    const now = Date.now();
    if (this.positionsCache && (now - this.cacheTime) < this.CACHE_TTL) {
      return this.positionsCache;
    }
    const positions = await this.repo.find({ order: { code: 'ASC' } });
    this.positionsCache = positions;
    this.cacheTime = now;
    return positions;
  }

  async findByCode(code: string) {
    // Cache lookup first
    if (this.positionsCache) {
      const cached = this.positionsCache.find(p => p.code === code);
      if (cached) return cached;
    }
    return this.repo.findOneBy({ code });
  }
}
