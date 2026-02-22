// @ts-nocheck
// process-graph-jobs: Drains the graph_jobs Postgres queue.
// Triggered by the "Build Graph" admin button or a curl during demo setup.
// Processes up to $batch_size pending jobs per call.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkDemoKey } from '../_shared/auth.ts'
import { isNeo4jConfigured } from '../_shared/neo4j.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EDGE_BASE = `${SUPABASE_URL.replace('https://', 'https://')}/functions/v1`
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const DEMO_KEY = Deno.env.get('DEMO_KEY') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-demo-key',
}

const MAX_ATTEMPTS = 3

// After MAX_ATTEMPTS failures, move the job to the dead-letter table
async function moveToDeadLetter(
    supabase: any,
    job: { id: string; save_id: string; user_phone: string; attempts: number },
    errorMessage: string
): Promise<void> {
    await Promise.all([
        supabase.from('failed_graph_jobs').insert({
            original_job_id: job.id,
            save_id: job.save_id,
            user_phone: job.user_phone,
            attempts: job.attempts + 1,
            last_error: errorMessage,
        }),
        supabase.from('graph_jobs').update({
            status: 'dead',
            last_error: errorMessage,
            updated_at: new Date().toISOString(),
        }).eq('id', job.id),
    ])
    console.warn(`[process-jobs] Job ${job.id} moved to dead-letter queue after ${job.attempts + 1} attempts.`)
}
const DEFAULT_BATCH_SIZE = 10

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const authError = checkDemoKey(req)
    if (authError) return authError

    const body = await req.json().catch(() => ({}))
    const batchSize = Math.min(body.batch_size || DEFAULT_BATCH_SIZE, 50)

    const now = new Date().toISOString()

    // Fetch pending jobs (also retry errored jobs that haven't exceeded max attempts)
    const { data: jobs, error: fetchErr } = await supabase
        .from('graph_jobs')
        .select('id, save_id, user_phone, attempts')
        .in('status', ['pending', 'error'])
        .lt('attempts', MAX_ATTEMPTS)
        .order('created_at', { ascending: true })
        .limit(batchSize)

    if (fetchErr) {
        return new Response(JSON.stringify({ error: fetchErr.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    if (!jobs || jobs.length === 0) {
        return new Response(JSON.stringify({ processed: 0, errors: 0, message: 'No pending jobs' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    let processed = 0, errors = 0
    const results: any[] = []

    for (const job of jobs) {
        // Mark as processing
        await supabase.from('graph_jobs').update({
            status: 'processing',
            attempts: job.attempts + 1,
            updated_at: new Date().toISOString(),
        }).eq('id', job.id)

        try {
            // Call graph-upsert-save for this job
            const res = await fetch(`${EDGE_BASE}/graph-upsert-save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ANON_KEY}`,
                    ...(DEMO_KEY ? { 'X-DEMO-KEY': DEMO_KEY } : {}),
                },
                body: JSON.stringify({ save_id: job.save_id, user_phone: job.user_phone }),
            })

            const data = await res.json()

            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

            // Mark done
            await supabase.from('graph_jobs').update({
                status: 'done',
                updated_at: new Date().toISOString(),
            }).eq('id', job.id)

            processed++
            results.push({ job_id: job.id, save_id: job.save_id, entity_count: data.entity_count })

        } catch (err) {
            console.error(`[process-jobs] Job ${job.id} failed (attempt ${job.attempts + 1}/${MAX_ATTEMPTS}):`, err.message)

            if (job.attempts + 1 >= MAX_ATTEMPTS) {
                // Exhausted all retries — move to dead-letter queue
                await moveToDeadLetter(supabase, job, err.message)
            } else {
                // Still has retries remaining — mark as error for future pickup
                await supabase.from('graph_jobs').update({
                    status: 'error',
                    last_error: err.message,
                    updated_at: new Date().toISOString(),
                }).eq('id', job.id)
            }

            errors++
        }

        // Small delay between calls to avoid hammering Gemini
        await new Promise(r => setTimeout(r, 800))
    }

    return new Response(JSON.stringify({
        processed,
        errors,
        total_fetched: jobs.length,
        neo4j_active: isNeo4jConfigured(),
        results,
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
})
