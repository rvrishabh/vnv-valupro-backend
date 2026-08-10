import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { InstitutionTypesModule } from './institution-types/institution-types.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { UserModule } from './user/user.module';
import { ValuationEstimateModule } from './valuation-estimate/valuation-estimate.module';

@Module({
  imports: [
    CommonModule,
    PrismaModule,
    AuthModule,
    UserModule,
    RolesModule,
    PermissionsModule,
    InstitutionTypesModule,
    InstitutionsModule,
    BranchesModule,
    ValuationEstimateModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
