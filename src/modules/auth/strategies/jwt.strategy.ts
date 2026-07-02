import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { JwtPayload } from '../services/token.service';
import { extractAccessToken } from '../utils/extract-access-token.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: extractAccessToken,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload) {
    if (!payload.sub || payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token');
    }

    return {
      id: payload.sub,
      email: payload.email,
      roleId: payload.roleId,
      roleName: payload.roleName,
      isApproved: payload.isApproved,
      isActive: payload.isActive,
      institutionId: payload.institutionId,
      branchId: payload.branchId,
    };
  }
}
