import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity()
@Index('idx_position_time', ['position', 'startAt', 'endAt'])
@Index('idx_user_future', ['userVid', 'endAt'])
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userName!: string;

  @Column()
  userVid!: string;

  @Column()
  position!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'datetime', nullable: true })
  startAt!: string | null;

  @Column({ type: 'datetime', nullable: true })
  endAt!: string | null;

  @Column({ default: false })
  trainingMode!: boolean;

  @Column({ default: false })
  examMode!: boolean;

  @Column({ default: false })
  noVoice!: boolean;

  @Column({ nullable: true })
  type!: string; // training|event|exam

  @CreateDateColumn()
  createdAt!: Date;
}
