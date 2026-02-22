// @ts-nocheck
// _shared/rateLimit.ts
// Persistent, DB-backed per-phone rate limiter using the Supabase rate_limits table.
// Uses a rolling window: requests made more than windowHours ago are excluded.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

/**
 * Rate limit definitions per endpoint.
 * 'limit' = max calls per phone per rolling window (default: 24h).
 */
export const DAILY_LIMITS: Record<string, number> = {
    'classify-llm': 20,
    'embed': 50,
    'vision': 5,
    'whisper': 5,
    'chat-brain': 15,
    'deep-research': 3,
    'weekly-recap': 3,
    'predictive-analysis': 30,
}

/**
 * Returns { allowed: true } if within limits, or { allowed: false } if blocked.
 * Increments the counter and checks errors properly.
 */
export async function checkRateLimit(
    phone: string,
    endpoint: string,
    windowHours = 24
): Promise<{ allowed: boolean; count: number; limit: number; resetAt: string }> {
    const limit = DAILY_LIMITS[endpoint] ?? 20
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()

    try {
        // Check existing count in rolling window
        const { data: existing, error: selectError } = await supabase
            .from('rate_limits')
            .select('id, request_count, window_start')
            .eq('identifier', phone)
            .eq('endpoint', endpoint)
            .gte('window_start', windowStart)
            .order('window_start', { ascending: false })
            .limit(1)
            .single()

        if (selectError && selectError.code !== 'PGRST116') {
            // PGRST116 = no rows found — that's fine. Any other error is a real DB issue.
            console.error('[rate-limit] Select failed:', selectError.message)
        }

        if (existing) {
            // Compute resetAt from the actual rolling window_start of the row
            const resetAt = new Date(
                new Date(existing.window_start).getTime() + windowHours * 3600 * 1000
            ).toISOString()

            if (existing.request_count >= limit) {
                console.warn(`[rate-limit] ${phone}/${endpoint} hit limit (${existing.request_count}/${limit})`)
                return { allowed: false, count: existing.request_count, limit, resetAt }
            }

            // Increment counter — check for errors
            const { error: updateError } = await supabase
                .from('rate_limits')
                .update({ request_count: existing.request_count + 1 })
                .eq('id', existing.id)

            if (updateError) {
                console.error('[rate-limit] Update failed:', updateError.message)
                // Allow the request but log degradation
            }

            return { allowed: true, count: existing.request_count + 1, limit, resetAt }
        } else {
            // First call in this window — create a new row
            const now = new Date().toISOString()
            const resetAt = new Date(Date.now() + windowHours * 3600 * 1000).toISOString()

            const { error: insertError } = await supabase.from('rate_limits').insert({
                identifier: phone,
                endpoint,
                request_count: 1,
                window_start: now,
            })

            if (insertError) {
                console.error('[rate-limit] Insert failed:', insertError.message)
            }

            return { allowed: true, count: 1, limit, resetAt }
        }
    } catch (err) {
        // If the rate limit check itself fails (DB error), allow the request
        // to avoid blocking legitimate users due to infrastructure issues.
        console.error('[rate-limit] DB error, allowing request:', err.message)
        const resetAt = new Date(Date.now() + windowHours * 3600 * 1000).toISOString()
        return { allowed: true, count: 0, limit, resetAt }
    }
}
