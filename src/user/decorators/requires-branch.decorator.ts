import { ValidationOptions, registerDecorator, ValidationArguments } from 'class-validator';
import { UserRole } from '../schemas/user.schema';

export function RequiresBranchIfManager(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'requiresBranchIfManager',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: any, args: ValidationArguments) {
                    const obj = args.object as any;
                    // If role is branch_manager, branchId is required
                    if (obj.role === UserRole.BRANCH_MANAGER) {
                        return value !== undefined && value !== null && value !== '';
                    }
                    return true; // Not required for other roles
                },
                defaultMessage(args: ValidationArguments) {
                    return 'branchId is required when role is branch_manager';
                },
            },
        });
    };
}