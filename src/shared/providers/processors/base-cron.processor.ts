import { AppLogger } from '@/shared/utils/app-logger.utils';

export abstract class BaseCronProcessor {
  protected readonly logger: AppLogger;

  protected constructor(processorName: string) {
    this.logger = new AppLogger(processorName);
  }

  abstract process(): Promise<void>;
}
