import { UserRole } from '../enums/user-role.enum';

export const USER_ROLE_LEVEL = {
  [UserRole.SUPERADMIN]: 99,
  [UserRole.ADMIN]: 10,
  [UserRole.SHIPPER]: 2,
  [UserRole.DELIVERY]: 2,
  [UserRole.FINANCIAL]: 2,
  [UserRole.USER]: 1,
};
