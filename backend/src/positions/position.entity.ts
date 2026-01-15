import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Position {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  code!: string;

  @Column({ nullable: true })
  name!: string;

  @Column({ default: 1 })
  capacity!: number;

  @Column({ nullable: true })
  role!: string;

  @Column({ nullable: true })
  division!: string;

  @Column({ default: 1 })
  requiredRating!: number;
}
