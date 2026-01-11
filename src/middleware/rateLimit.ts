import rateLimit from 'express-rate-limit';

// Standard rate limiter (100 req/min)
export const standardLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests', code: 'RATE_LIMITED' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict rate limiter (20 req/min)
export const strictLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many requests', code: 'RATE_LIMITED' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Auth rate limiter (10 req/min)
export const authLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Too many requests', code: 'RATE_LIMITED' },
    standardHeaders: true,
    legacyHeaders: false,
});
