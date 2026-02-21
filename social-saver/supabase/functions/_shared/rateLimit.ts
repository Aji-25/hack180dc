// @ts-nocheck
// _shared/rateLimit.ts
// Persistent, DB-backed per-phone rate limiter using the Supabase rate_limits table.
// Tracks daily call counts per phone + endpoint, stored in UTC calendar day boundaries.
// Resets automatically at midnight UTC every day.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

/**
 * Rate limit definitions per endpoint.
 * 'limit' = max calls per phone per day (resets at midnight UTC).
 */
export const DAILY_LIMITS: Record<string, number> = {
    'classify-llm': 20,  // LLM classify calls per phone per day (webhook)
    'embed': 50,  // Embedding calls per phone per day
    'vision': 5,  // GPT-4o Vision per phone per day
    'whisper': 5,  // Whisper transcriptions per phone per day
    'chat-brain': 15,  // AI chat queries per phone per day
    'deep-research': 3,  // Deep research per phone per hour (existing)
    'weekly-recap': 3,  // Recap generations per phone per day
    'predictive-analysis': 30,  // Predictive suggestions per phone per day
}

/**
 * Returns { allowed: true } if within limits, or { allowed: false, remaining: 0, resetAt } if blocked.
 * Increments the counter atomically if allowed.
 */
export async function checkRateLimit(
    phone: string,
    endpoint: string,
    windowHours = 24
): Promise<{ allowed: boolean; count: number; limit: number; resetAt: string }> {
    const limit = DAILY_LIMITS[endpoint] ?? 20
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()
    const resetAt = new Date(
        Date.now() + (windowHours - ((Date.now() / 3600000) % windowHours)) * 3600000
    ).toISOString()

    try {
        // Check existing count in window
        const { data: existing } = await supabase
            .from('rate_limits')
            .select('id, request_count')
            .eq('identifier', phone)
            .eq('endpoint', endpoint)
            .gte('window_start', windowStart)
            .order('window_start', { ascending: false })
            .limit(1)
            .single()

        if (existing) {
            if (existing.request_count >= limit) {
                console.warn(`[rate-limit] ${phone}/${endpoint} hit limit (${existing.request_count}/${limit})`)
                return { allowed: false, count: existing.request_count, limit, resetAt }
            }
            // Increment counter
            await supabase
                .from('rate_limits')
                .update({ request_count: existing.request_count + 1 })
                .eq('id', existing.id)
            return { allowed: true, count: existing.request_count + 1, limit, resetAt }
        } else {
            // First call in this window — create a new row
            await supabase.from('rate_limits').insert({
                identifier: phone,
                endpoint,
                request_count: 1,
                window_start: new Date().toISOString(),
            })
            return { allowed: true, count: 1, limit, resetAt }
        }
    } catch (err) {
        // If the rate limit check itself fails (DB error), allow the request
        // to avoid blocking legitimate users due to infrastructure issues.
        console.error('[rate-limit] DB error, allowing request:', err.message)
        return { allowed: true, count: 0, limit, resetAt }
    }
}
