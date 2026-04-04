import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class WsJwtGuard implements CanActivate {
    constructor(private jwtService: JwtService) { }

    canActivate(context: ExecutionContext): boolean {
        const client: Socket = context.switchToWs().getClient();
        const token = (client.handshake?.auth as any)?.token;

        if (!token) {
            console.log('❌ [WsJwtGuard] No token provided');
            return false;
        }

        try {
            const payload = this.jwtService.verify(token);
            client.handshake.auth.userId = payload.sub || payload.id;
            return true;
        } catch (error) {
            console.log('❌ [WsJwtGuard] Invalid token:', error);
            return false;
        }
    }
}
