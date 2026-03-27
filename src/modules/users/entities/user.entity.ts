import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../enums/user-role.enum';

@Entity('users')
@Index('IDX_user_email', ['email'], { unique: true })
export class User {
  @ApiProperty({
    description: 'User unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'User full name',
    example: 'João Silva',
  })
  @Column({ nullable: false })
  name: string;

  @ApiProperty({
    description: 'User email address',
    example: 'joao.silva@email.com',
  })
  @Column({ nullable: false, unique: true })
  email: string;

  @Column({ nullable: false, select: false })
  password: string;

  @Column({ nullable: false, default: UserRole.USER })
  role: UserRole;

  @Column({ nullable: true, select: false })
  refreshToken?: string;

  @ApiProperty({
    description: 'User creation date',
    example: '2024-01-01T12:00:00Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'User last update date',
    example: '2024-01-01T12:00:00Z',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];
}
