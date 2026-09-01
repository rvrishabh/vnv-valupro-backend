import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { R2Service } from './services/r2.service';
import { RedisService } from './services/redis.service';
import { ZavuService } from './services/zavu.service';

@Global()
@Module({
  providers: [
    RedisService,
    ZavuService,
    R2Service,
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
  exports: [RedisService, ZavuService, R2Service],
})
export class CommonModule {}
