import { AppLogger } from '../../utils/app-logger.utils';

export abstract class BaseScheduler {
  protected readonly logger: AppLogger;

  protected constructor(serviceName: string) {
    this.logger = new AppLogger(serviceName);
  }
}
