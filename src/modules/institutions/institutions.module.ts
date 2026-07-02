import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstitutionTypesModule } from '../institution-types/institution-types.module';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsService } from './institutions.service';
import { InstitutionsRepository } from './repositories/institutions.repository';

@Module({
  imports: [forwardRef(() => AuthModule), InstitutionTypesModule],
  controllers: [InstitutionsController],
  providers: [InstitutionsService, InstitutionsRepository],
  exports: [InstitutionsService, InstitutionsRepository],
})
export class InstitutionsModule {}
