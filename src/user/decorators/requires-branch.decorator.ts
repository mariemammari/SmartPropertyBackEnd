import {
  ValidationOptions,
  registerDecorator,
  ValidationArguments,
} from 'class-validator';
import { UserRole } from '../schemas/user.schema';

export function RequiresBranchIfManagerOrAccountant(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'requiresBranchIfManagerOrAccountant',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any;
          // If role is branch_manager or accountant, branchId is required
          if (
            obj.role === UserRole.BRANCH_MANAGER ||
            obj.role === UserRole.ACCOUNTANT
          ) {
            return value !== undefined && value !== null && value !== '';
          }
          return true; // Not required for other roles
        },
        defaultMessage(args: ValidationArguments) {
          return 'branchId is required when role is branch_manager or accountant';
        },
      },
    });
  };
}
