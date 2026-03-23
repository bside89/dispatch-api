import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateLoginDto } from './dto/update-login.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly CACHE_TTL = 3600 * 1000; // 1 hour
  private readonly IDEMPOTENCY_PREFIX = 'user_idempotency';
  private readonly IDEMPOTENCY_TTL = 86400 * 1000; // 24 hours

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly cacheService: CacheService,
    private readonly authService: AuthService,
  ) {}

  async create(
    createUserDto: CreateUserDto,
    idempotencyKey: string,
  ): Promise<UserResponseDto> {
    const idempotencyKeyFormatted = `${this.IDEMPOTENCY_PREFIX}:${idempotencyKey}`;

    // Check if this idempotency key already exists
    const existingUser = await this.cacheService.get<UserResponseDto>(
      idempotencyKeyFormatted,
    );

    if (existingUser) {
      this.logger.log(
        `Returning existing user for idempotency key: ${idempotencyKey}, User ID: ${existingUser.id}`,
      );
      return existingUser;
    }

    this.logger.log(
      `Creating new user with idempotency key: ${idempotencyKey}`,
    );

    // Check if email already exists
    const existingEmailUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingEmailUser) {
      throw new ConflictException('Email already exists');
    }

    const user = this.userRepository.create({
      name: createUserDto.name,
      email: createUserDto.email,
      password: await this.authService.hashPassword(createUserDto.password),
    });

    const savedUser = await this.userRepository.save(user);
    const userResponse = this.mapToResponseDto(savedUser);

    // Cache the created user with idempotency key
    await this.cacheService.set(
      idempotencyKeyFormatted,
      userResponse,
      this.IDEMPOTENCY_TTL,
    );

    this.logger.log(
      `User created and cached with idempotency key: ${idempotencyKey}, User ID: ${savedUser.id}`,
    );

    return userResponse;
  }

  async findAll(query: UserQueryDto): Promise<UserResponseDto[]> {
    this.logger.log('Retrieving all users');

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Apply filters
    if (query.name) {
      queryBuilder.andWhere('user.name ILIKE :name', {
        name: `%${query.name}%`,
      });
    }

    if (query.email) {
      queryBuilder.andWhere('user.email ILIKE :email', {
        email: `%${query.email}%`,
      });
    }

    // Apply pagination
    if (query.limit) {
      queryBuilder.limit(Math.min(query.limit, 100));
    } else {
      queryBuilder.limit(20); // Default limit
    }

    if (query.offset) {
      queryBuilder.offset(query.offset);
    }

    // Order by creation date
    queryBuilder.orderBy('user.createdAt', 'DESC');

    const users = await queryBuilder.getMany();
    this.logger.log(`Retrieved ${users.length} users`);
    const result = users.map((user) => this.mapToResponseDto(user));

    return result;
  }

  async findOne(id: string): Promise<UserResponseDto> {
    this.logger.log(`Retrieving user with ID: ${id}`);

    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    this.logger.log(`User found: ${user.email}`);
    return this.mapToResponseDto(user);
  }

  async findByEmail(email: string): Promise<UserResponseDto> {
    this.logger.log(`Finding user by email: ${email}`);

    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    this.logger.log(`User found with email: ${email}`);
    return this.mapToResponseDto(user);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    this.logger.log(`Updating user with ID: ${id}`);

    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check if email already exists (if email is being updated)
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
    }

    // Update user fields
    Object.assign(user, updateUserDto);

    const updatedUser = await this.userRepository.save(user);
    this.logger.log(`User updated successfully: ${updatedUser.email}`);

    // Update the jwt cache
    const cacheKey = `user_${updatedUser.id}`;
    await this.cacheService.set(cacheKey, updatedUser, this.CACHE_TTL); // Cache for 1 hour

    return this.mapToResponseDto(updatedUser);
  }

  async updateLogin(
    id: string,
    updateLoginDto: UpdateLoginDto,
  ): Promise<UserResponseDto> {
    this.logger.log(`Updating login for user with ID: ${id}`);

    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'name', 'email', 'password', 'createdAt', 'updatedAt'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Validate current password if new password is provided
    if (updateLoginDto.newPassword) {
      if (!updateLoginDto.currentPassword) {
        throw new BadRequestException(
          'Current password is required to change password',
        );
      }

      // Verify current password
      if (
        !(await this.authService.verifyPassword(
          user.password,
          updateLoginDto.currentPassword,
        ))
      ) {
        throw new BadRequestException('Current password is incorrect');
      }

      // Hash new password with argon2
      user.password = await this.authService.hashPassword(
        updateLoginDto.newPassword,
      );
    }

    // Update email if provided
    if (updateLoginDto.email && updateLoginDto.email !== user.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: updateLoginDto.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already exists');
      }

      user.email = updateLoginDto.email;
    }

    const updatedUser = await this.userRepository.save(user);
    this.logger.log(
      `Login updated successfully for user: ${updatedUser.email}`,
    );

    // Update the jwt cache
    const cacheKey = `user_${updatedUser.id}`;
    await this.cacheService.set(cacheKey, updatedUser, this.CACHE_TTL); // Cache for 1 hour

    return this.mapToResponseDto(updatedUser);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting user with ID: ${id}`);

    const result = await this.userRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    this.logger.log(`User with ID ${id} deleted successfully`);

    // Remove the user from the jwt cache
    const cacheKey = `user_${id}`;
    await this.cacheService.delete(cacheKey);
  }

  private mapToResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
