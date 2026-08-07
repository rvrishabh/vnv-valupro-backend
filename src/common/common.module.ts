import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { RedisService } from './services/redis.service';
import { ZavuService } from './services/zavu.service';

@Global()
@Module({
  providers: [
    RedisService,
    ZavuService,
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
  exports: [RedisService, ZavuService],
})
export class CommonModule {}
