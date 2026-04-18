import { AppLogger } from '../utils/app-logger';
import { IBaseService } from './base-service.interface';

export abstract class BaseService implements IBaseService {
  protected readonly logger: AppLogger;

  constructor(serviceName: string) {
    this.logger = new AppLogger(serviceName);
  }
}
