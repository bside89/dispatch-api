import { BaseJobPayload } from '../payloads/base-job.payload';
import { BaseJobStrategy } from '../providers/strategies/base-job.strategy';

export abstract class BaseJobHandlerFactory {
  abstract createHandler(jobType: string): BaseJobStrategy<BaseJobPayload> | null;
}
