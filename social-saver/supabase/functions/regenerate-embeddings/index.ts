// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function generateEmbedding(text: string): Promise<number[] | null> {
    try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
        })

        if (!response.ok) {
            console.error('Embedding error:', await response.text())
            return null
        }

        const data = await response.json()
        return data.data?.[0]?.embedding || null
    } catch (e) {
        console.error('Embedding failed:', e)
        return null
    }
}

// Simple delay to respect rate limits (15 RPM free tier)
function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Fetch all saves that need embeddings
        const { data: saves, error } = await supabase
            .from('saves')
            .select('id, title, category, summary, tags, content')
            .is('embedding', null)
            .order('created_at', { ascending: false })
            .limit(10) // Process 10 at a time to stay within 60s timeout

        if (error) throw error

        if (!saves || saves.length === 0) {
            return new Response(JSON.stringify({ message: 'No saves need embedding regeneration', count: 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        let successCount = 0
        let failCount = 0

        for (const save of saves) {
            const textToEmbed = [
                save.title,
                save.category,
                save.summary,
                Array.isArray(save.tags) ? save.tags.join(' ') : '',
                save.content ? save.content.slice(0, 1000) : '',
            ].filter(Boolean).join(' ')

            if (!textToEmbed.trim()) {
                failCount++
                continue
            }

            const embedding = await generateEmbedding(textToEmbed)

            if (embedding) {
                const { error: updateError } = await supabase
                    .from('saves')
                    .update({ embedding })
                    .eq('id', save.id)

                if (updateError) {
                    console.error(`Failed to update save ${save.id}:`, updateError)
                    failCount++
                } else {
                    successCount++
                }
            } else {
                failCount++
            }

            // Small delay to respect rate limits
            await delay(200)
        }

        return new Response(JSON.stringify({
            message: `Regeneration complete`,
            total: saves.length,
            success: successCount,
            failed: failCount,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
