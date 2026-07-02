import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstitutionTypesModule } from '../institution-types/institution-types.module';
import { InstitutionsModule } from '../institutions/institutions.module';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { BranchesRepository } from './repositories/branches.repository';
import { IfscLookupService } from './services/ifsc-lookup.service';

@Module({
  imports: [forwardRef(() => AuthModule), InstitutionsModule, InstitutionTypesModule],
  controllers: [BranchesController],
  providers: [BranchesService, BranchesRepository, IfscLookupService],
  exports: [BranchesService, BranchesRepository, IfscLookupService],
})
export class BranchesModule {}
