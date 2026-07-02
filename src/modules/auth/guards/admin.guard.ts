import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: { roleName?: string } }>();
    if (request.user?.roleName !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
