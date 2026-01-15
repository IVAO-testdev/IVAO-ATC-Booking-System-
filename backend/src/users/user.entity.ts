import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('users')
@Index('idx_vid', ['vid'], { unique: true })
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  vid!: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ default: 0 })
  rating!: number;

  @Column({ nullable: true })
  ratingLevel?: string;

  @Column({ nullable: true })
  countryId?: string;

  @Column({ nullable: true })
  divisionId?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ nullable: true })
  lastRatingUpdate?: Date;
}
