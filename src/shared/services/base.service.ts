import { AppLogger } from '../utils/app-logger';

export abstract class BaseService {
  protected readonly logger: AppLogger;

  constructor(serviceName: string) {
    this.logger = new AppLogger(serviceName);
  }
}
