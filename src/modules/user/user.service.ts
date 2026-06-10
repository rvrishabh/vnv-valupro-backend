import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AUTH_METHOD, LoginChannel, Prisma } from 'generated/prisma/client';
import { FindQuery } from 'types/common.types';
import { UserFilter } from 'types/user.types';
import { toFindQuery } from 'src/common/utils/to-find-query.util';
import {
  CreateUserDto,
  ListUsersQueryDto,
  UpdateUserBankIdDto,
  UpdateUserDto,
} from './dto/user.request.dto';
import { toUserResponse } from './mappers/user.mapper';
import {
  USER_INCLUDE,
  UserRepository,
  UserWithRelations,
} from './repositories/user.repository';

const SALT_ROUNDS = 10;

@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async create(data: CreateUserDto) {
    await this.assertEmailAvailable(data.email);
    if (data.mobile) {
      await this.assertMobileAvailable(data.mobile);
    }

    const role = await this.userRepo.findRoleById(data.roleId);
    if (!role || role.loginChannel !== LoginChannel.WEB) {
      throw new BadRequestException('roleId must be a WEB loginChannel role');
    }

    if (data.bankId) {
      const bank = await this.userRepo.findActiveBank(data.bankId);
      if (!bank) {
        throw new BadRequestException('Invalid bank');
      }
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const user = await this.userRepo.create(
      {
        name: data.name,
        email: data.email,
        mobile: data.mobile,
        passwordHash,
        authMethod: AUTH_METHOD.PASSWORD,
        isApproved: true,
        isActive: true,
        role: { connect: { id: data.roleId } },
        ...(data.bankId && { bank: { connect: { id: data.bankId } } }),
      },
      USER_INCLUDE,
    );

    return toUserResponse(user);
  }

  async findAll(query: ListUsersQueryDto) {
    const result = await this.userRepo.findAll(
      this.buildUserListQuery(query),
      USER_INCLUDE,
    );

    return {
      ...result,
      data: result.data.map((user) => toUserResponse(user)),
    };
  }

  async findOne(id: string) {
    const user = await this.userRepo.findByIdWithRelations(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toUserResponse(user);
  }

  async update(id: string, data: UpdateUserDto) {
    const user = await this.userRepo.findByIdWithRelations(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (data.roleId) {
      const role = await this.userRepo.findRoleById(data.roleId);
      if (!role || role.loginChannel !== LoginChannel.WEB) {
        throw new BadRequestException('roleId must be a WEB loginChannel role');
      }
    }

    if (data.mobile) {
      await this.assertMobileAvailable(data.mobile, id);
    }

    if (data.bankId) {
      const bank = await this.userRepo.findActiveBank(data.bankId);
      if (!bank) {
        throw new BadRequestException('Invalid bank');
      }
    }

    const updatePayload: Prisma.UserUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.mobile !== undefined && { mobile: data.mobile }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.roleId && { role: { connect: { id: data.roleId } } }),
      ...(data.bankId && { bank: { connect: { id: data.bankId } } }),
    };

    if (data.password) {
      updatePayload.passwordHash = await bcrypt.hash(
        data.password,
        SALT_ROUNDS,
      );
    }

    const updated = await this.userRepo.updateById(
      id,
      updatePayload,
      USER_INCLUDE,
    );
    return toUserResponse(updated);
  }

  async approve(id: string) {
    const user = await this.getUserOrThrow(id);
    if (user.role.loginChannel !== LoginChannel.MOBILE) {
      throw new BadRequestException('Only mobile users can be approved');
    }
    if (user.isApproved) {
      throw new BadRequestException('User is already approved');
    }

    const updated = await this.userRepo.updateById(
      id,
      { isApproved: true },
      USER_INCLUDE,
    );
    return toUserResponse(updated);
  }

  async deactivate(id: string) {
    const user = await this.userRepo.findByIdWithRelations(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.isActive) {
      throw new BadRequestException('User is already deactivated');
    }

    const updated = await this.userRepo.updateById(
      id,
      { isActive: false },
      USER_INCLUDE,
    );
    return toUserResponse(updated);
  }

  async updateBank(id: string, data: UpdateUserBankIdDto) {
    const user = await this.getUserOrThrow(id);
    if (user.role.loginChannel !== LoginChannel.MOBILE) {
      throw new BadRequestException('Bank assignment is for mobile users only');
    }

    const bank = await this.userRepo.findActiveBank(data.bankId);
    if (!bank) {
      throw new BadRequestException('Invalid bank');
    }

    const updated = await this.userRepo.updateById(
      id,
      { bank: { connect: { id: data.bankId } } },
      USER_INCLUDE,
    );
    return toUserResponse(updated);
  }

  private buildUserListQuery(query: ListUsersQueryDto): FindQuery<UserFilter> {
    const filter: UserFilter = {
      isApproved: query.isApproved,
      isActive: query.isActive,
      roleId: query.roleId,
      loginChannel: query.loginChannel,
    };
    return toFindQuery<UserFilter>(query, filter);
  }

  private async getUserOrThrow(id: string): Promise<UserWithRelations> {
    const user = await this.userRepo.findByIdWithRelations(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async assertEmailAvailable(email: string) {
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }
  }

  private async assertMobileAvailable(mobile: string, excludeId?: string) {
    const existing = await this.userRepo.findByMobile(mobile);
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('Mobile already in use');
    }
  }
}
