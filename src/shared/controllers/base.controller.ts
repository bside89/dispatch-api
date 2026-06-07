import { AppLogger } from '../utils/app-logger.utils';

export abstract class BaseController {
  protected readonly logger: AppLogger;

  constructor(controllerName: string) {
    this.logger = new AppLogger(controllerName);
  }
}
