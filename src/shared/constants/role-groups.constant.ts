import { UserRole } from '../enums/user-role.enum';

/**
 * Named role groups used in @Roles() decorators across controllers.
 * Centralises role combinations so changes to permissions require a single edit.
 */
export const ROLE_GROUPS = {
  ORDER: {
    /** Full financial visibility: can view, update status, cancel and refund orders */
    FINANCIAL: [
      UserRole.SUPERADMIN,
      UserRole.ADMIN,
      UserRole.FINANCIAL,
    ] as UserRole[],

    /** Core management: can update and delete records */
    MANAGEMENT: [UserRole.SUPERADMIN, UserRole.ADMIN] as UserRole[],

    /** Shipping operations: can mark orders as shipped */
    SHIPPING: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SHIPPER] as UserRole[],

    /** Delivery operations: can mark orders as delivered */
    DELIVERY: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.DELIVERY] as UserRole[],
  },

  COMMON: {
    /** Admin-only item and user management */
    ADMIN_MANAGEMENT: [UserRole.SUPERADMIN, UserRole.ADMIN] as UserRole[],
  },
} as const;
