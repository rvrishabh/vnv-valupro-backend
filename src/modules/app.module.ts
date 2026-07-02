import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { InstitutionTypesModule } from './institution-types/institution-types.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    CommonModule,
    PrismaModule,
    AuthModule,
    UserModule,
    InstitutionTypesModule,
    InstitutionsModule,
    BranchesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
