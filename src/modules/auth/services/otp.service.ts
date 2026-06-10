import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

type OtpPurpose = 'registration' | 'login';

@Injectable()
export class OtpService implements OnModuleDestroy {
  private readonly redis?: Redis;
  private readonly memory = new Map<
    string,
    { otp: string; expiresAt: number }
  >();

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.redis = new Redis(redisUrl);
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  private buildKey(email: string, purpose: OtpPurpose): string {
    return `otp:email:${purpose}:${email.toLowerCase()}`;
  }

  async store(
    email: string,
    purpose: OtpPurpose,
    otp: string,
    ttlSeconds = 300,
  ): Promise<void> {
    const key = this.buildKey(email, purpose);
    if (this.redis) {
      await this.redis.setex(key, ttlSeconds, otp);
      return;
    }
    this.memory.set(key, {
      otp,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async verify(
    email: string,
    purpose: OtpPurpose,
    otp: string,
  ): Promise<boolean> {
    const key = this.buildKey(email, purpose);
    if (this.redis) {
      const stored = await this.redis.get(key);
      if (!stored || stored !== otp) {
        return false;
      }
      await this.redis.del(key);
      return true;
    }

    const entry = this.memory.get(key);
    if (!entry || entry.expiresAt < Date.now() || entry.otp !== otp) {
      return false;
    }
    this.memory.delete(key);
    return true;
  }
}
