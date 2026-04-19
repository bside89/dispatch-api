import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Custom decorator to extract the user from the request object.
 * Can be used in controller methods to easily access the authenticated user.
 * @param data Optional property name to extract from the user object.
 * @param ctx Execution context provided by NestJS.
 * @returns The user object or the specified property from the user object.
 * @example
 * // To get the entire user object:
 * @GetUser() user: RequestUser
 *
 * // To get a specific property (e.g., email) from the user object:
 * @GetUser('email') email: string
 */
export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (data) return request.user?.[data];
    return request.user;
  },
);
