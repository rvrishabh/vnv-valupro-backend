import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor<
  unknown,
  ApiSuccessResponse<unknown>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<ApiSuccessResponse<unknown>> {
    return next.handle().pipe(
      map(
        (data: unknown): ApiSuccessResponse<unknown> => ({
          success: true,
          data,
          timestamp: new Date().toISOString(),
        }),
      ),
    );
  }
}
