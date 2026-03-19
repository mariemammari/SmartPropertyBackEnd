import { ValidationOptions, registerDecorator, ValidationArguments } from 'class-validator';
import { UserRole } from '../schemas/user.schema';

export function RequiresDobIfClient(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'requiresDobIfClient',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: any, args: ValidationArguments) {
                    const obj = args.object as any;
                    // If role is client (or not specified, defaults to client), dateOfBirth is required
                    const isClient = !obj.role || obj.role === UserRole.CLIENT;
                    if (isClient) {
                        return value !== undefined && value !== null && value !== '';
                    }
                    return true; // Not required for non-clients
                },
                defaultMessage(args: ValidationArguments) {
                    return 'dateOfBirth is required for client role';
                },
            },
        });
    };
}