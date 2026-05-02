import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';
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

    private readonly AUTH_PATH_PREFIXES = ['/auth', '/auth/'];
    private readonly AUTH_LIMIT = 20;
    private readonly AUTH_TTL_MS = 60000;

    protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const path: string = req?.path || '';
        return this.BYPASS_SEGMENTS.some(seg =>
            path.toLowerCase().includes(seg),
        );
    }

    protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
        const { context } = requestProps;
        const { req } = this.getRequestResponse(context);
        const path: string = (req?.path || '').toLowerCase();

        const isAuthPath = this.AUTH_PATH_PREFIXES.some(prefix =>
            path.startsWith(prefix),
        );
        if (!isAuthPath) {
            return super.handleRequest(requestProps);
        }

        const limit = Math.min(requestProps.limit, this.AUTH_LIMIT);
        const ttl = Math.max(requestProps.ttl, this.AUTH_TTL_MS);
        const blockDuration = Math.max(requestProps.blockDuration, ttl);

        return super.handleRequest({
            ...requestProps,
            limit,
            ttl,
            blockDuration,
        });
    }
}
