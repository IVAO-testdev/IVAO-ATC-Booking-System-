import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsModule } from './bookings/bookings.module';
import { Booking } from './bookings/booking.entity';
import { PositionsModule } from './positions/positions.module';
import { UsersModule } from './users/users.module';
import { User } from './users/user.entity';
import { AuthController } from './auth/auth.controller';
import { Position } from './positions/position.entity';
import { IvaoModule } from './ivao/ivao.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ivao_booking',
      entities: [Booking, Position, User],
      synchronize: true,
    }),
    BookingsModule,
    PositionsModule,
    UsersModule,
    IvaoModule,
  ],
  controllers: [AuthController],
})
export class AppModule {}
