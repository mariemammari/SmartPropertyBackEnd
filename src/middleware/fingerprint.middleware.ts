import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class FingerprintMiddleware implements NestMiddleware {
    // Paths that skip fingerprinting entirely (webhooks, monitoring, etc.)
    private readonly SKIP_FINGERPRINT_PATHS = [
        // Payment webhooks
        'webhook',
        // DevOps / monitoring
        'metrics',
        'health',
        'healthz',
        'liveness',
        'readiness',
        'ready',
        'ping',
        'actuator',
        // Real-time
        'socket.io',
        // Swagger/API docs
        'swagger',
        'api-docs',
        'api-json',
    ];

    // Strict bot signatures: only flag clearly malicious or scripted scrapers.
    // NOTE: 'axios' and 'axios-http' are intentionally excluded here because:
    //   - Stripe uses node-fetch/axios internally for webhook delivery
    //   - Internal microservices and mobile apps often use axios
    //   - Legitimate browsers can also proxy through axios
    private readonly BOT_SIGNATURES = [
        'python-requests',
        'scrapy',
        'wget',
        'go-http-client',
        'java/',
        'libwww-perl',
        'mechanize',
        'aiohttp',
        'httpx',
        'masscan',
        'zgrab',
        'nuclei',
        'sqlmap',
        'nikto',
    ];

    use(req: Request, res: Response, next: NextFunction) {
        const path = req.path || '';

        // Skip fingerprinting for webhooks and internal monitoring
        const skip = this.SKIP_FINGERPRINT_PATHS.some(seg =>
            path.toLowerCase().includes(seg),
        );
        if (skip) {
            req['fingerprint'] = { ip: req.ip, userAgent: 'trusted-bypass', isBot: false };
            req['suspicionScore'] = 0;
            return next();
        }

        const forwarded = req.headers['x-forwarded-for'];
        const ip = req.ip || (Array.isArray(forwarded) ? forwarded[0] : forwarded) || 'unknown';

        const uaHeader = req.headers['user-agent'];
        const userAgent = Array.isArray(uaHeader) ? uaHeader.join(', ') : uaHeader || 'unknown';

        // Detect bots only by clear, non-ambiguous signatures
        const ua = userAgent.toLowerCase();
        const isBot = this.BOT_SIGNATURES.some(sig => ua.includes(sig));

        const languageHeader = req.headers['accept-language'];
        const language = Array.isArray(languageHeader) ? languageHeader.join(', ') : languageHeader || 'unknown';

        const refererHeader = req.headers['referer'] || req.headers['referrer'];
        const referer = Array.isArray(refererHeader) ? refererHeader[0] : refererHeader || null;

        req['fingerprint'] = {
            ip,
            userAgent,
            language,
            referer,
            timestamp: Date.now(),
            endpoint: path,
            isBot,
        };

        // Bots start at 80 (block threshold), clean requests start at 0
        req['suspicionScore'] = isBot ? 80 : 0;

        next();
    }
}
