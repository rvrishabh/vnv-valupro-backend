import { User } from 'generated/prisma/client';
import { UserResponseDto } from '../dto/user.response.dto';

export type { UserWithRelations } from '../repositories/user.repository';

export function toUserResponse(user: User): UserResponseDto {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, googleId, fcmToken, ...safe } = user;
  return safe as UserResponseDto;
}
