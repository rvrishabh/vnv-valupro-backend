import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserWithRelations } from '../../user/repositories/user.repository';

export interface JwtPayload {
  sub: string;
  email: string;
  roleId: string;
  roleName: string;
  isApproved: boolean;
  isActive: boolean;
  institutionId?: string | null;
  branchId?: string | null;
  type: 'access' | 'refresh';
}

export const ACCESS_TTL = '15m';
export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  async generateTokens(user: UserWithRelations) {
    const base = this.buildPayload(user);

    const accessToken = await this.jwtService.signAsync(
      { ...base, type: 'access' as const },
      {
        secret: this.getAccessSecret(),
        expiresIn: ACCESS_TTL,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { ...base, type: 'refresh' as const },
      {
        secret: this.getRefreshSecret(),
        expiresIn: REFRESH_TTL_SECONDS,
      },
    );

    return { accessToken, refreshToken };
  }

  async verifyRefreshToken(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.getRefreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return payload.sub;
  }

  private buildPayload(user: UserWithRelations): Omit<JwtPayload, 'type'> {
    return {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      isApproved: user.isApproved,
      isActive: user.isActive,
      institutionId: user.institutionId,
      branchId: user.branchId,
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
