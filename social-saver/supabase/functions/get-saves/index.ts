// @ts-nocheck
// supabase/functions/get-saves/index.ts
// Returns saved items for a user with optional filtering.
// Uses service_role — the anon key cannot query saves directly after RLS lockdown.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })

    try {
        const url = new URL(req.url)
        const phone = url.searchParams.get('phone') || ''
        const search = url.searchParams.get('search') || ''
        const category = url.searchParams.get('category') || ''
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const offset = parseInt(url.searchParams.get('offset') || '0')
        const statsMode = url.searchParams.get('stats') === 'true'
        const randomMode = url.searchParams.get('random') === 'true'

        // phone is required — prevents cross-tenant reads
        if (!phone) {
            return new Response(JSON.stringify({ error: 'phone param is required' }), {
                status: 400, headers: corsHeaders,
            })
        }

        // ── Stats mode: return category + created_at for client-side aggregation ──
        if (statsMode) {
            const { data, error } = await supabase
                .from('saves')
                .select('category, created_at')
                .eq('user_phone', phone)
                .neq('is_deleted', true)
            if (error) throw error
            return new Response(JSON.stringify(data || []), { status: 200, headers: corsHeaders })
        }

        // ── Random mode: return a single random save by offset ──
        if (randomMode) {
            // First get count for this user
            const { count } = await supabase
                .from('saves')
                .select('*', { count: 'exact', head: true })
                .eq('user_phone', phone)
                .eq('status', 'complete')
                .neq('is_deleted', true)

            if (!count || count === 0) {
                return new Response(JSON.stringify(null), { status: 200, headers: corsHeaders })
            }

            const randomOffset = parseInt(url.searchParams.get('offset') || String(Math.floor(Math.random() * count)))
            const { data } = await supabase
                .from('saves')
                .select('*')
                .eq('user_phone', phone)
                .eq('status', 'complete')
                .neq('is_deleted', true)
                .range(randomOffset, randomOffset)

            return new Response(JSON.stringify(data?.[0] || null), { status: 200, headers: corsHeaders })
        }

        // ── Default: paginated saves list ──
        let query = supabase
            .from('saves')
            .select('*')
            .eq('user_phone', phone)
            .neq('is_deleted', true)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (category && category !== 'All') query = query.eq('category', category)
        if (search && search.trim()) query = query.textSearch('fts', search.trim(), { type: 'websearch' })

        // Quick filters
        const source = url.searchParams.get('source')
        if (source) query = query.eq('source', source)

        const withNotes = url.searchParams.get('with_notes') === 'true'
        if (withNotes) query = query.not('note', 'is', null)

        const recentSince = url.searchParams.get('recent_since')
        if (recentSince) query = query.gte('created_at', recentSince)

        const { data, error } = await query
        if (error) {
            console.error('Query error:', error)
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
        }

        return new Response(JSON.stringify(data || []), { status: 200, headers: corsHeaders })
    } catch (err) {
        console.error('get-saves error:', err)
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
    }
})
