import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import { AuthClient, MobileAuthClient } from 'types/auth.types';

interface GoogleTokenPayload {
  email?: string;
  sub?: string;
  aud?: string;
  email_verified?: string | boolean;
}

@Injectable()
export class GoogleAuthService {
  async verifyIdToken(
    idToken: string,
    client: MobileAuthClient,
  ): Promise<{ email: string; googleId: string }> {
    const { data } = await axios.get<GoogleTokenPayload>(
      'https://oauth2.googleapis.com/tokeninfo',
      { params: { id_token: idToken } },
    );

    if (!data.email || !data.sub) {
      throw new BadRequestException('Invalid Google token');
    }

    const emailVerified =
      data.email_verified === true || data.email_verified === 'true';
    if (!emailVerified) {
      throw new BadRequestException('Google email is not verified');
    }

    const expectedClientId = this.getClientId(client);
    if (expectedClientId && data.aud !== expectedClientId) {
      throw new BadRequestException('Google token audience mismatch');
    }

    return { email: data.email, googleId: data.sub };
  }

  private getClientId(client: MobileAuthClient): string | undefined {
    if (client === AuthClient.BANK_MANAGER_APP) {
      return process.env.GOOGLE_CLIENT_ID_BANK_MANAGER;
    }
    return process.env.GOOGLE_CLIENT_ID_SITE_ENGINEER;
  }
}
