import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';

/**
 * Custom ThrottlerGuard that bypasses rate limiting for:
 * - Prometheus /metrics endpoint (scraped every 15s)
 * - Kubernetes/Docker health & readiness probes
 * - Stripe & payment webhooks (secured by signature, not rate limiting)
 * - Uptime monitoring pings
 * - Socket.io WebSocket upgrade requests
 * - Swagger UI documentation fetching
 */
@Injectable()
export class SmartPropertyThrottlerGuard extends ThrottlerGuard {
    private readonly BYPASS_SEGMENTS = [
        'metrics',
        'health',
        'healthz',
        'liveness',
        'readiness',
        'ready',
        'ping',
        'webhook',
        'socket.io',
        'swagger',
        'api-docs',
        'api-json',
        'actuator',
    ];

    protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const path: string = req?.path || '';
        return this.BYPASS_SEGMENTS.some(seg =>
            path.toLowerCase().includes(seg),
        );
    }
}
