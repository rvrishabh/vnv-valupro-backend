import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

function isPaginatedPayload(
  value: unknown,
): value is Record<string, unknown> & { data: unknown[] } {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Array.isArray((value as { data?: unknown }).data)
  );
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor<
  unknown,
  ApiSuccessResponse
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<ApiSuccessResponse> {
    return next.handle().pipe(
      map((payload: unknown): ApiSuccessResponse => {
        // Paginated: { data: T[], total, page, limit, totalPages }
        // → { success, data: T[], total, page, limit, totalPages }
        if (isPaginatedPayload(payload)) {
          return {
            success: true,
            ...payload,
          };
        }

        // Single object / array / primitive → wrap under data
        return {
          success: true,
          data: payload,
        };
      }),
    );
  }
}
