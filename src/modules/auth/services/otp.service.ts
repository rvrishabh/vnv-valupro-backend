import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'src/common/services/redis.service';

export type OtpPurpose = 'registration' | 'login';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  private readonly keys = {
    otp: (email: string, purpose: OtpPurpose) =>
      `otp:${purpose}:${email.toLowerCase()}`,
    attempts: (email: string, purpose: OtpPurpose) =>
      `otp:attempts:${purpose}:${email.toLowerCase()}`,
    rateLimit: (email: string, purpose: OtpPurpose) =>
      `otp:rate:${purpose}:${email.toLowerCase()}`,
  };

  private readonly OTP_TTL = 5 * 60; // 5 minutes
  private readonly RATE_LIMIT_TTL = 15 * 60; // 15 minutes
  private readonly ATTEMPTS_TTL = 10 * 60; // 10 minutes
  private readonly MAX_SENDS = 3; // max OTPs per 15min
  private readonly MAX_ATTEMPTS = 5; // max wrong attempts

  constructor(private readonly redis: RedisService) {}

  /** Generate OTP, enforce send rate limit, store in Redis. Returns OTP for email delivery. */
  async create(email: string, purpose: OtpPurpose): Promise<string> {
    await this.assertCanSend(email, purpose);

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await this.redis.set(this.keys.otp(email, purpose), otp, this.OTP_TTL);

    return otp;
  }

  async verify(
    email: string,
    purpose: OtpPurpose,
    otp: string,
  ): Promise<boolean> {
    const attemptsKey = this.keys.attempts(email, purpose);
    const attempts = Number((await this.redis.get(attemptsKey)) ?? 0);

    if (attempts >= this.MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many failed OTP attempts. Request a new OTP.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const stored = await this.redis.get(this.keys.otp(email, purpose));
    if (!stored || stored !== otp) {
      const failed = await this.redis.incr(attemptsKey);
      if (failed === 1) {
        await this.redis.expire(attemptsKey, this.ATTEMPTS_TTL);
      }
      return false;
    }

    await Promise.all([
      this.redis.del(this.keys.otp(email, purpose)),
      this.redis.del(attemptsKey),
    ]);
    return true;
  }

  private async assertCanSend(
    email: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const rateKey = this.keys.rateLimit(email, purpose);
    const count = await this.redis.incr(rateKey);

    if (count === 1) {
      await this.redis.expire(rateKey, this.RATE_LIMIT_TTL);
    }

    if (count > this.MAX_SENDS) {
      const retryAfter = await this.redis.ttl(rateKey);
      this.logger.warn(`OTP rate limit exceeded for ${email} (${purpose})`);
      throw new HttpException(
        `Too many OTP requests. Try again in ${Math.max(retryAfter, 60)} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
