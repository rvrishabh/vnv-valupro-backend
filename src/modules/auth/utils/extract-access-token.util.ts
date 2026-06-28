import { ExtractJwt } from 'passport-jwt';
import { ACCESS_TOKEN_COOKIE } from '../services/auth-cookie.service';

type RequestWithCookies = {
  headers?: { authorization?: string };
  cookies?: Record<string, string>;
};

export function extractAccessToken(req: RequestWithCookies): string | null {
  const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (fromHeader) {
    return fromHeader;
  }

  return req.cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}
