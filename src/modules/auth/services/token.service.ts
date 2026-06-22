import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { RedisService } from 'src/common/services/redis.service';
import { UserWithRelations } from '../../user/repositories/user.repository';

export interface JwtPayload {
  sub: string;
  email: string;
  roleId: string;
  roleName: string;
  isApproved: boolean;
  isActive: boolean;
  bankId?: string | null;
  type: 'access' | 'refresh';
  jti?: string;
}

const ACCESS_TTL = '15m';
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
  ) {}

  async issueTokens(user: UserWithRelations) {
    const base = this.buildPayload(user);
    const jti = randomUUID();

    const accessToken = await this.jwtService.signAsync(
      { ...base, type: 'access' as const },
      {
        secret: this.getAccessSecret(),
        expiresIn: ACCESS_TTL,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { ...base, type: 'refresh' as const, jti },
      {
        secret: this.getRefreshSecret(),
        expiresIn: REFRESH_TTL_SECONDS,
      },
    );

    await this.redis.set(`refresh:${jti}`, user.id, REFRESH_TTL_SECONDS);

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.getRefreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const storedUserId = await this.redis.get(`refresh:${payload.jti}`);
    if (!storedUserId || storedUserId !== payload.sub) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }

    await this.redis.del(`refresh:${payload.jti}`);
    return payload.sub;
  }

  async revoke(refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        { secret: this.getRefreshSecret() },
      );
      if (payload.jti) {
        await this.redis.del(`refresh:${payload.jti}`);
      }
    } catch {
      // Idempotent logout — ignore invalid tokens
    }
  }

  private buildPayload(
    user: UserWithRelations,
  ): Omit<JwtPayload, 'type' | 'jti'> {
    return {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      isApproved: user.isApproved,
      isActive: user.isActive,
      bankId: user.bankId,
    };
  }

  private getAccessSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new InternalServerErrorException('JWT_SECRET is not configured');
    }
    return secret;
  }

  private getRefreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET;
    if (!secret) {
      throw new InternalServerErrorException(
        'JWT_REFRESH_SECRET is not configured',
      );
    }
    return secret;
  }
}
