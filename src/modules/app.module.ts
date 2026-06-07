import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [CommonModule, PrismaModule, AuthModule, UserModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
