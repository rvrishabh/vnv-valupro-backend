import { Injectable } from '@nestjs/common';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS } from './token.service';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  path?: string;
  maxAge?: number;
};

export type AuthCookieReply = {
  setCookie(name: string, value: string, options?: CookieOptions): unknown;
  clearCookie(name: string, options?: Pick<CookieOptions, 'path'>): unknown;
};

export type AuthCookieRequest = {
  cookies?: Record<string, string | undefined>;
};

@Injectable()
export class AuthCookieService {
  setAuthCookies(
    reply: AuthCookieReply,
    accessToken: string,
    refreshToken: string,
  ): void {
    const isProduction = process.env.NODE_ENV === 'production';

    reply.setCookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_TTL_SECONDS,
    });

    reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/v1/auth/refresh',
      maxAge: REFRESH_TTL_SECONDS,
    });
  }

  clearAuthCookies(reply: AuthCookieReply): void {
    reply.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    reply.clearCookie(REFRESH_TOKEN_COOKIE, {
      path: '/api/v1/auth/refresh',
    });
  }

  getRefreshToken(request: AuthCookieRequest): string | undefined {
    return request.cookies?.[REFRESH_TOKEN_COOKIE];
  }
}
