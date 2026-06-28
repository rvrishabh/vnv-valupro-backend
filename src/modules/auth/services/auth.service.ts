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
import { Resend } from 'resend';
import {
  AuthClient,
  CLIENT_TO_ROLE_NAME,
  MobileAuthClient,
} from 'types/auth.types';
import { toUserResponse } from '../../user/mappers/user.mapper';
import {
  USER_INCLUDE,
  UserRepository,
  UserWithRelations,
} from '../../user/repositories/user.repository';
import {
  LoginDto,
  RefreshTokenDto,
  RegisterSendEmailOtpDto,
  RegisterVerifyEmailOtpDto,
  SendEmailOtpDto,
  VerifyEmailOtpDto,
} from '../dto/auth.request.dto';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
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
  async registerSendEmailOtp(data: RegisterSendEmailOtpDto) {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw new ConflictException(
        'Email already registered. Use login instead.',
      );
    }

    await this.dispatchEmailOtp(data.email, 'registration');
    return { message: 'OTP sent to email' };
  }

  /** Mobile signup — verify OTP and create user (no JWT until approved). */
  async registerVerifyEmailOtp(data: RegisterVerifyEmailOtpDto) {
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

    if (data.mobile) {
      await this.assertMobileAvailable(data.mobile);
    }

    const user = await this.createMobileUser({
      email: data.email,
      name: data.name,
      client: data.client,
      bankId: data.bankId,
      mobile: data.mobile,
    });

    return {
      message: 'Registration successful. Awaiting admin approval.',
      user: toUserResponse(user),
    };
  }

  /** Mobile login — send OTP to existing user. */
  async sendEmailOtp(data: SendEmailOtpDto) {
    const user = await this.userRepo.findByEmail(data.email);
    if (!user) {
      throw new BadRequestException('User not found. Please register first.');
    }
    this.assertClientMatchesRole(data.client, user.role.name);

    await this.dispatchEmailOtp(data.email, 'login');
    return { message: 'OTP sent to email' };
  }

  /** Mobile login — verify OTP and return JWT tokens. */
  async verifyEmailOtp(data: VerifyEmailOtpDto) {
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
  async refreshTokens(data: RefreshTokenDto) {
    const userId = await this.tokenService.verifyRefreshToken(
      data.refreshToken,
    );
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
    name: string;
    client: MobileAuthClient;
    bankId?: string;
    mobile?: string;
  }) {
    const roleName = CLIENT_TO_ROLE_NAME[input.client];
    const role = await this.userRepo.findRoleByName(roleName);
    if (!role || role.loginChannel !== LoginChannel.MOBILE) {
      throw new InternalServerErrorException('Mobile role not configured');
    }

    if (input.client === AuthClient.BANK_MANAGER_APP) {
      if (!input.bankId) {
        throw new BadRequestException('bankId is required for bank manager');
      }
      const bank = await this.userRepo.findActiveBank(input.bankId);
      if (!bank) {
        throw new BadRequestException('Invalid bank');
      }
    } else if (input.bankId) {
      throw new BadRequestException('bankId is not allowed for site engineer');
    }

    return this.userRepo.create(
      {
        name: input.name,
        email: input.email,
        mobile: input.mobile,
        authMethod: AUTH_METHOD.EMAIL_OTP,
        passwordHash: null,
        isApproved: false,
        isActive: true,
        role: { connect: { id: role.id } },
        ...(input.bankId && { bank: { connect: { id: input.bankId } } }),
      },
      USER_INCLUDE,
    );
  }

  private async dispatchEmailOtp(
    email: string,
    purpose: 'registration' | 'login',
  ) {
    const otp = await this.otpService.create(email, purpose);

    const emailFrom = process.env.EMAIL_FROM;
    if (!emailFrom) {
      throw new InternalServerErrorException('EMAIL_FROM is not configured');
    }

    const emailSubject =
      purpose === 'registration' ? 'Welcome to ValuPro' : 'Your ValuPro Login';

    const { error } = await this.resend.emails.send({
      from: emailFrom,
      to: email,
      subject: emailSubject,
      html: `<p>Your OTP is <strong>${otp}</strong>. It expires in 5 minutes.</p>`,
    });

    if (error) {
      this.logger.error(`Resend error: ${error.message}`);
      throw new InternalServerErrorException('Failed to send OTP email');
    }

    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[DEV OTP ${purpose}] ${email}`);
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

  private async assertMobileAvailable(mobile: string) {
    const existing = await this.userRepo.findByMobile(mobile);
    if (existing) {
      throw new ConflictException('Mobile already in use');
    }
  }
}
