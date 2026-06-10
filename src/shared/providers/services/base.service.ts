import { AppLogger } from '../../utils/app-logger.utils';
import { IBaseService } from './base-service.interface';

export abstract class BaseService implements IBaseService {
  protected readonly logger: AppLogger;

  protected constructor(serviceName: string) {
    this.logger = new AppLogger(serviceName);
  }
}
