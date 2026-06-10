import { USER_REPOSITORY } from '@/modules/users/constants/users.token';
import type { IUserRepository } from '@/modules/users/interfaces/user-repository.interface';
import { LOCK_KEY } from '@/shared/constants/lock.key';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { UpdateUserJobPayload } from '@/shared/payloads/user-job.payload';
import { BaseJobStrategy } from '@/shared/providers/strategies/base-job.strategy';
import { Inject, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';

@Injectable()
export class UpdateUserJobStrategy extends BaseJobStrategy<UpdateUserJobPayload> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    private readonly guard: DbGuardService,
  ) {
    super(UpdateUserJobStrategy.name);
  }

  async execute(job: Job<UpdateUserJobPayload>): Promise<void> {
    const { userId, customerId } = job.data;

    const user = await this.userRepository.findById(userId);
    if (!user) return;

    await this.guard.lock(LOCK_KEY.USER.UPDATE(userId), async () => {
      await this.userRepository.update(userId, { customerId });
    });

    this.logger.log(`Updated data for user ${userId}`, { userId, customerId });
  }

  async executeAfterFail(
    job: Job<UpdateUserJobPayload>,
    error: Error,
  ): Promise<void> {
    this.logger.error(
      `[CRITICAL] Failed to update data for user after all retries: ${error.message}`,
      { userId: job.data.userId },
    );
  }
}
