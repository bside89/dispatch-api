import { Global, Module } from '@nestjs/common';
import { DbGuardService } from './db-guard.service';

@Global()
@Module({
  exports: [DbGuardService],
  providers: [DbGuardService],
})
export class DbGuardModule {}
