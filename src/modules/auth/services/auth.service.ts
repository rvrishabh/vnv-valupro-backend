import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AUTH_METHOD, LoginChannel } from 'generated/prisma/client';
import { ZavuService } from 'src/common/services/zavu.service';
import {
  CLIENT_TO_ROLE_NAME,
  IRegisterVerifyMobileOtp,
  ISendMobileLoginOtp,
  ISendMobileRegisterOtp,
  IVerifyMobileLoginOtp,
  MobileAuthClient,
  OtpChannel,
} from 'types/auth.types';
import { toUserResponse } from '../../user/mappers/user.mapper';
import {
  USER_INCLUDE,
  UserRepository,
  UserWithRelations,
} from '../../user/repositories/user.repository';
import { LoginDto } from '../dto/auth.request.dto';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    private readonly zavu: ZavuService,
  ) {}

  /** Web portal — email + password login. */
  async login(data: LoginDto) {
    const user = await this.userRepo.findByEmail(data.email);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.role.loginChannel !== LoginChannel.WEB) {
      throw new ForbiddenException('Use the mobile app to sign in');
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    this.assertUserCanLogin(user);

    return this.buildAuthResponse(user);
  }

  /** Mobile signup — email must not exist yet. */
  async sendMobileRegisterOtp(data: ISendMobileRegisterOtp) {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new ConflictException(
        'Email already registered. Use login instead.',
      );
    }

    await this.dispatchOtp(data.email, 'registration', {
      channel: data.channel,
      mobile: data.mobile,
    });
    return {
      message:
        (data.channel ?? 'email') === 'whatsapp'
          ? 'OTP sent via WhatsApp'
          : 'OTP sent to email',
    };
  }

  /** Mobile signup — verify OTP and create user (no JWT until approved). */
  async verifyMobileRegisterOtp(data: IRegisterVerifyMobileOtp) {
    console.log('data', data);
    const isValid = await this.otpService.verify(
      data.email,
      'registration',
      String(data.otp),
    );
    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.createMobileUser({
      email: data.email,
      client: data.client,
    });

    return {
      message: 'Registration successful. Awaiting admin approval.',
      user: toUserResponse(user),
    };
  }

  /** Mobile login — send OTP to existing user. */
  async sendMobileLoginOtp(data: ISendMobileLoginOtp) {
    const user = await this.userRepo.findByEmail(data.email);
    if (!user) {
      throw new BadRequestException('User not found. Please register first.');
    }
    this.assertClientMatchesRole(data.client, user.role.name);

    const channel = data.channel ?? 'email';
    const mobile =
      data.mobile ??
      (channel === 'whatsapp' ? (user.mobile ?? undefined) : undefined);

    await this.dispatchOtp(data.email, 'login', { channel, mobile });
    return {
      message:
        channel === 'whatsapp' ? 'OTP sent via WhatsApp' : 'OTP sent to email',
    };
  }

  /** Mobile login — verify OTP and return JWT tokens. */
  async verifyMobileLoginOtp(data: IVerifyMobileLoginOtp) {
    const user = await this.userRepo.findByEmail(data.email);
    if (!user) {
      throw new BadRequestException('User not found. Please register first.');
    }

    this.assertClientMatchesRole(data.client, user.role.name);

    const isValid = await this.otpService.verify(
      data.email,
      'login',
      String(data.otp),
    );
    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    this.assertUserCanLogin(user);

    return this.buildAuthResponse(user);
  }

  /** Exchange a valid refresh token for a new token pair. */
  async refreshTokens(refreshToken: string) {
    const userId = await this.tokenService.verifyRefreshToken(refreshToken);
    const user = await this.userRepo.findByIdWithRelations(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    this.assertUserCanLogin(user);

    return this.buildAuthResponse(user);
  }

  /** Stateless JWT — client should discard tokens locally. */
  logout() {
    return { message: 'Logged out successfully' };
  }

  private async buildAuthResponse(user: UserWithRelations) {
    const tokens = await this.tokenService.generateTokens(user);
    return { ...tokens, user: toUserResponse(user) };
  }

  private async createMobileUser(input: {
    email: string;
    client: MobileAuthClient;
  }) {
    const roleName = CLIENT_TO_ROLE_NAME[input.client];
    const role = await this.userRepo.findRoleByName(roleName);
    if (!role || role.loginChannel !== LoginChannel.MOBILE) {
      throw new InternalServerErrorException('Mobile role not configured');
    }

    const provisionalName = input.email.split('@')[0] || 'User';

    return this.userRepo.create(
      {
        name: provisionalName,
        email: input.email,
        authMethod: AUTH_METHOD.EMAIL_OTP,
        passwordHash: null,
        isApproved: false,
        isActive: true,
        role: { connect: { id: role.id } },
      },
      USER_INCLUDE,
    );
  }

  private async dispatchOtp(
    email: string,
    purpose: 'registration' | 'login',
    options?: { channel?: OtpChannel; mobile?: string },
  ) {
    const otp = await this.otpService.create(email, purpose);

    if (options?.channel === 'whatsapp') {
      if (!options?.mobile) {
        throw new BadRequestException(
          'Mobile number is required to send OTP via WhatsApp',
        );
      }
      await this.zavu.sendWhatsAppOtp({ to: options.mobile, otp });
    } else {
      const subject =
        purpose === 'registration'
          ? 'Welcome to VNV Engineers (ValPro)'
          : 'Your VNV Engineers (ValPro) Login';
      await this.zavu.sendEmailOtp({ to: email, otp, subject });
    }

    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(
        `[DEV OTP ${purpose}] channel=${options?.channel ?? 'email'} email=${email}`,
      );
    }
  }

  private assertUserCanLogin(user: UserWithRelations) {
    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }
    if (!user.isApproved) {
      throw new ForbiddenException('Account pending admin approval');
    }
  }

  private assertClientMatchesRole(client: MobileAuthClient, roleName: string) {
    if (CLIENT_TO_ROLE_NAME[client] !== roleName) {
      throw new BadRequestException('Account does not belong to this app');
    }
  }
}
