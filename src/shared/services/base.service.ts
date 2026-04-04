import { AppLogger } from '../utils/app-logger';

export abstract class BaseService {
  protected readonly logger: AppLogger;

  constructor(protected readonly serviceName: string) {
    this.logger = new AppLogger(serviceName);
  }
}
