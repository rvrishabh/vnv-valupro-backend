import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { CasesRepository } from './repositories/cases.repository';
import { CaseWorkflowService } from './services/case-workflow.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [CasesController],
  providers: [CasesService, CasesRepository, CaseWorkflowService],
  exports: [CasesService, CasesRepository, CaseWorkflowService],
})
export class CasesModule {}
