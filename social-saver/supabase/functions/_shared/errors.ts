// @ts-nocheck
// supabase/functions/_shared/errors.ts
//
// Standardized JSON error response factory for all edge functions.
// Ensures every error returns a consistent shape:
//   { error: string, status: number, ...extra? }
//
// Usage:
//   import { errorResponse, badRequest, notFound, unauthorized } from '../_shared/errors.ts'
//   return badRequest('query is required')
//   return errorResponse('Neo4j timed out', 503, { retryAfter: 30 })

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type, x-demo-key',
} as const;

/**
 * Generic JSON error response with CORS headers.
 *
 * @param message  Human-readable error message (also logged server-side).
 * @param status   HTTP status code (default 500).
 * @param extra    Optional extra fields merged into the response body.
 */
export function errorResponse(
    message: string,
    status = 500,
    extra?: Record<string, unknown>
): Response {
    console.error(`[edge-error] ${status}: ${message}`);
    return new Response(
        JSON.stringify({ error: message, status, ...extra }),
        {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
    );
}

/** 400 — missing or invalid request data */
export function badRequest(detail = 'Bad request'): Response {
    return errorResponse(detail, 400);
}

/** 401 — missing or invalid credentials */
export function unauthorized(detail = 'Unauthorized'): Response {
    return errorResponse(detail, 401);
}

/** 404 — resource not found */
export function notFound(resource = 'Resource'): Response {
    return errorResponse(`${resource} not found`, 404);
}

/** 429 — rate limit exceeded */
export function rateLimited(limit: number, resetInfo?: string): Response {
    return errorResponse(
        `Rate limit exceeded (${limit}/day). ${resetInfo ?? 'Try again tomorrow.'}`,
        429,
        { limit, reset: resetInfo }
    );
}

/** 503 — upstream service unavailable (DB, Neo4j, OpenAI) */
export function serviceUnavailable(service = 'Upstream service'): Response {
    return errorResponse(`${service} is currently unavailable.`, 503);
}
