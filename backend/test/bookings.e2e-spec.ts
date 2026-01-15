import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsModule } from '../src/bookings/bookings.module';
import { PositionsModule } from '../src/positions/positions.module';
import { Booking } from '../src/bookings/booking.entity';
import { Position } from '../src/positions/position.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('Bookings (e2e)', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Booking, Position],
          synchronize: true,
          logging: true,
        }),
        BookingsModule,
        PositionsModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer();

    const posRepo = moduleRef.get<Repository<Position>>(getRepositoryToken(Position));
    await posRepo.save(posRepo.create({ code: 'TWR', name: 'Test Tower', capacity: 1, role: 'TWR' }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a booking then prevents overlapping booking for same position', async () => {
    const now = new Date();
    const s1 = new Date(now.getTime() + 3600 * 1000);
    const e1 = new Date(now.getTime() + 2 * 3600 * 1000);

    const r1 = await request(server).post('/auth/login').send({ vid: 'NOWNER' });
    expect(r1.body.token).toBeDefined();
    const token1 = r1.body.token;

    const createRes = await request(server)
      .post('/bookings')
      .set('Authorization', `Bearer ${token1}`)
      .send({ userName: 'Owner', position: 'TWR', startAt: s1.toISOString(), endAt: e1.toISOString() });
    expect(createRes.status).toBeLessThan(400);
    const bookingId = createRes.body.id;
    expect(bookingId).toBeDefined();

    const r2 = await request(server).post('/auth/login').send({ vid: 'NOTHER' });
    const token2 = r2.body.token;

    const overlapRes = await request(server)
      .post('/bookings')
      .set('Authorization', `Bearer ${token2}`)
      .send({ userName: 'Other', position: 'TWR', startAt: s1.toISOString(), endAt: e1.toISOString() });

    expect(overlapRes.status).toBe(400);
  });

  it('prevents non-owner from deleting and allows owner to delete', async () => {
    const now = new Date();
    const s1 = new Date(now.getTime() + 5 * 3600 * 1000);
    const e1 = new Date(now.getTime() + 6 * 3600 * 1000);

    const r1 = await request(server).post('/auth/login').send({ vid: 'DELA' });
    const t1 = r1.body.token;

    const createRes = await request(server)
      .post('/bookings')
      .set('Authorization', `Bearer ${t1}`)
      .send({ userName: 'Dela', position: 'TWR', startAt: s1.toISOString(), endAt: e1.toISOString() });
    const id = createRes.body?.id;
    if (!id) throw new Error('Failed to create booking');

    const r2 = await request(server).post('/auth/login').send({ vid: 'NOTOWNER' });
    const t2 = r2.body.token;

    const delRes = await request(server).delete(`/bookings/${id}`).set('Authorization', `Bearer ${t2}`);
    expect(delRes.status).toBe(403);

    const delRes2 = await request(server).delete(`/bookings/${id}`).set('Authorization', `Bearer ${t1}`);
    expect([200, 201, 204]).toContain(delRes2.status);
  });
});
