import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateLoginDto } from './dto/update-login.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserRepository } from './repositories/user.repository';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { User } from './entities/user.entity';
import { UserResponseDto } from './dto/user-response.dto';
import { HashUtils } from '@/shared/utils/hash.utils';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly IDEMPOTENCY_PREFIX = 'user_idempotency';
  private readonly IDEMPOTENCY_TTL = 86400 * 1000; // 24 hours

  constructor(
    private readonly cacheService: CacheService,
    private readonly userRepository: UserRepository,
  ) {}

  async create(
    createUserDto: CreateUserDto,
    idempotencyKey: string,
  ): Promise<UserResponseDto> {
    // Check if this idempotency key already exists
    const idempotencyKeyFormatted = `${this.IDEMPOTENCY_PREFIX}:${idempotencyKey}`;
    const existingUser = await this.cacheService.get<User>(
      idempotencyKeyFormatted,
    );
    if (existingUser) {
      this.logger.log(
        `Returning existing user for idempotency key: ${idempotencyKey}, User ID: ${existingUser.id}`,
      );
      return UserResponseDto.fromEntity(existingUser);
    }

    // Check if email already exists
    const existingEmailUser = await this.userRepository.findOneWhere({
      email: createUserDto.email,
    });
    if (existingEmailUser) {
      throw new ConflictException('Email already exists');
    }

    this.logger.log(
      `Creating new user with idempotency key: ${idempotencyKey}`,
    );

    const user = this.userRepository.createEntity({
      name: createUserDto.name,
      email: createUserDto.email,
      password: await HashUtils.hash(createUserDto.password),
    });

    const savedUser = await this.userRepository.save(user);

    // Cache the created user with idempotency key
    await this.cacheService.set(
      idempotencyKeyFormatted,
      savedUser,
      this.IDEMPOTENCY_TTL,
    );

    this.logger.log(
      `User created and cached with idempotency key: ${idempotencyKey}, User ID: ${savedUser.id}`,
    );

    return UserResponseDto.fromEntity(savedUser);
  }

  async findAll(
    query: UserQueryDto,
  ): Promise<PaginatedResultDto<UserResponseDto>> {
    this.logger.log('Retrieving all users');

    const result = await this.userRepository.findAllWithFilters(query);

    this.logger.log(`Retrieved ${result.data.length} users`);

    return {
      ...result,
      data: result.data.map(UserResponseDto.fromEntity),
    };
  }

  async findOne(id: string, retrieveToken = false): Promise<UserResponseDto> {
    this.logger.log(`Retrieving user with ID: ${id}`);

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    this.logger.log(`User found: ${user.email}`);

    return UserResponseDto.fromEntity(user);
  }

  async findByEmail(email: string): Promise<UserResponseDto> {
    this.logger.log(`Finding user by email: ${email}`);

    const user = await this.userRepository.findOneWhere({ email });
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    this.logger.log(`User found with email: ${email}`);

    return UserResponseDto.fromEntity(user);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    this.logger.log(`Updating user with ID: ${id}`);

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check if email already exists (if email is being updated)
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findOneWhere({
        email: updateUserDto.email,
      });

      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
    }

    // Update user fields
    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    this.logger.log(`User updated successfully: ${updatedUser.email}`);

    return UserResponseDto.fromEntity(updatedUser);
  }

  async updateLogin(
    id: string,
    updateLoginDto: UpdateLoginDto,
  ): Promise<UserResponseDto> {
    this.logger.log(`Updating login for user with ID: ${id}`);

    const user = await this.userRepository.findById(id, [
      'id',
      'name',
      'email',
      'password',
      'createdAt',
      'updatedAt',
    ]);

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
        !(await HashUtils.compare(
          user.password,
          updateLoginDto.currentPassword,
        ))
      ) {
        throw new BadRequestException('Current password is incorrect');
      }

      // Hash new password with argon2
      user.password = await HashUtils.hash(updateLoginDto.newPassword);
    }

    // Update email if provided
    if (updateLoginDto.email && updateLoginDto.email !== user.email) {
      const existingUser = await this.userRepository.findOneWhere({
        email: updateLoginDto.email,
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

    return UserResponseDto.fromEntity(updatedUser);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting user with ID: ${id}`);

    const result = await this.userRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    this.logger.log(`User with ID ${id} deleted successfully`);
  }
}
