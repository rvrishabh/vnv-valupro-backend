import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstitutionTypesController } from './institution-types.controller';
import { InstitutionTypesService } from './institution-types.service';
import { InstitutionTypesRepository } from './repositories/institution-types.repository';

@Module({
  imports: [AuthModule],
  controllers: [InstitutionTypesController],
  providers: [InstitutionTypesService, InstitutionTypesRepository],
  exports: [InstitutionTypesService, InstitutionTypesRepository],
})
export class InstitutionTypesModule {}
