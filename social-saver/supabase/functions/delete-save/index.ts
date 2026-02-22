// @ts-nocheck
// supabase/functions/delete-save/index.ts
// Accepts: { save_id, user_phone }
// Verifies ownership via user_phone hash match before soft-deleting.
// Uses service_role — the anon key cannot update directly after RLS lockdown.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { save_id, user_phone } = await req.json()

        if (!save_id || !user_phone) {
            return new Response(JSON.stringify({ error: 'save_id and user_phone are required' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Verify the save belongs to this phone hash (tenant isolation)
        const { data: existing, error: findErr } = await adminClient
            .from('saves')
            .select('id')
            .eq('id', save_id)
            .eq('user_phone', user_phone)
            .eq('is_deleted', false)
            .single()

        if (findErr || !existing) {
            return new Response(JSON.stringify({ error: 'Save not found or access denied' }), {
                status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Soft delete
        const { error: updateErr } = await adminClient
            .from('saves')
            .update({ is_deleted: true })
            .eq('id', save_id)

        if (updateErr) {
            console.error('[delete-save]', updateErr)
            return new Response(JSON.stringify({ error: 'Delete failed' }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (err) {
        console.error('[delete-save] Unhandled:', err.message)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
