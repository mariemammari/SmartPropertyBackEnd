import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';

@Injectable()
export class AntiScrapingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('AntiScraping');
    private requestLog = new Map<string, number[]>();

    // ── Full bypass: automated systems that use their own security ──────────
    // These should NEVER be scored, delayed, or blocked.
    private readonly FULL_BYPASS_SEGMENTS = [
        // Payment webhooks
        'webhook',

        // DevOps monitoring stack
        'metrics',          // Prometheus scraper (scrapes /metrics every 15s)
        'health',           // Docker/K8s liveness & readiness probes
        'healthz',          // Kubernetes-style health endpoint
        'liveness',         // K8s liveness probe
        'readiness',        // K8s readiness probe
        'ready',            // Shorthand readiness
        'ping',             // Simple uptime monitoring (UptimeRobot, Checkly)
        'actuator',         // Spring-style actuator (future compatibility)

        // Real-time connections
        'socket.io',        // WebSocket upgrade handshake

        // API Documentation (Swagger UI fetches docs on load)
        'swagger',
        'api-docs',
        'api-json',
    ];

    // ── Sensitive paths: skip scoring but allow request through ────────────
    // These are user/financial flows where false positives are unacceptable.
    private readonly SENSITIVE_PATH_PREFIXES = [
        '/auth/',           // Login, signup, token refresh
        '/auth',            // Direct /auth POST (e.g., /auth/signin)
        '/rentals/',        // Stripe payments, invoices, contracts
        '/rental/',         // Rental documents, PDF downloads
        '/finance/',        // Finance / payment management
        '/notifications/',  // Real-time notification delivery
        '/notification/',   // Notification internal routes
        '/mail/',           // Email service callbacks
        '/uploads/',        // File/media uploads
        '/property-media/', // Cloudinary media management
        '/application/',    // Rental applications (user submissions)
    ];

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const req = context.switchToHttp().getRequest();
        const path: string = req.path || '';

        // ── 1. Full bypass for monitoring/webhooks/sockets ───────────────────
        const isFullBypass = this.FULL_BYPASS_SEGMENTS.some(seg =>
            path.toLowerCase().includes(seg),
        );
        if (isFullBypass) {
            return next.handle();
        }

        // ── 2. Bypass for sensitive financial/auth/notification routes ────────
        const isSensitivePath = this.SENSITIVE_PATH_PREFIXES.some(prefix =>
            path.toLowerCase().startsWith(prefix),
        );
        if (isSensitivePath) {
            return next.handle();
        }

        // ── 3. Apply anti-scraping scoring ONLY for public browsing routes ────
        const ip = req['fingerprint']?.ip || req.ip;
        let score: number = req['fingerprint']?.isBot ? 80 : 0;

        const now = Date.now();
        const history = this.requestLog.get(ip) || [];
        const recentRequests = history.filter(t => now - t < 60000);
        recentRequests.push(now);
        this.requestLog.set(ip, recentRequests);

        // Rate-based scoring
        if (recentRequests.length > 100) score += 40;
        else if (recentRequests.length > 60) score += 20;

        // Missing referer penalty
        if (!req.headers['referer'] && !req.headers['referrer']) score += 10;

        req['suspicionScore'] = score;

        // ── Logging ──────────────────────────────────────────────────────────
        if (score >= 30) {
            this.logger.warn(
                `🚨 Suspicious request detected | IP: ${ip} | Score: ${score} | ` +
                `UA: ${req['fingerprint']?.userAgent || 'N/A'} | ` +
                `Path: ${req.method} ${path} | ` +
                `Requests/min: ${recentRequests.length} | ` +
                `Bot: ${req['fingerprint']?.isBot || false}`,
            );
        }

        // ── Response tiers ────────────────────────────────────────────────────
        if (score >= 80) {
            this.logger.error(`🛑 BLOCKED | IP: ${ip} | Score: ${score}`);
            throw new ForbiddenException('Access denied');
        }

        if (score >= 60) {
            this.logger.warn(`⚠️ HONEYPOT | IP: ${ip} | Score: ${score}`);
            return of({ data: [], message: 'No results found' });
        }

        if (score >= 30) {
            return new Observable((observer) => {
                const delayMs = 500 + Math.random() * 300;
                let innerSub: any;
                const timer = setTimeout(() => {
                    innerSub = next.handle().subscribe({
                        next: (v) => observer.next(v),
                        error: (e) => observer.error(e),
                        complete: () => observer.complete(),
                    });
                }, delayMs);
                return () => {
                    clearTimeout(timer);
                    if (innerSub && typeof innerSub.unsubscribe === 'function') innerSub.unsubscribe();
                };
            });
        }

        return next.handle();
    }
}
