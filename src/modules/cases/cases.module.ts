import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { CasesRepository } from './repositories/cases.repository';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [CasesController],
  providers: [CasesService, CasesRepository],
  exports: [CasesService, CasesRepository],
})
export class CasesModule {}
