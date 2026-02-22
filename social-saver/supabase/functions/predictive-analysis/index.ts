// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
import { callOpenAI } from "../_shared/llm.ts"
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { save } = await req.json()

        if (!save) throw new Error('Save object required')

        if (!Deno.env.get('OPENAI_API_KEY')) {
            // No API key — return empty suggestions gracefully
            return new Response(JSON.stringify({ suggestions: [] }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const prompt = `You are a "Minority Report" Predictive Engine.
User just saved a link. Your job: Anticipate what they need NEXT.

Return a JSON object with a "suggestions" key containing an array of 3 suggestion objects:
{
    "suggestions": [
        {
            "title": "Title of the suggested resource",
            "summary": "Why the user needs this (1 sentence)",
            "category": "Same category as input or related",
            "tags": ["predicted", "tag1"],
            "url": "https://google.com/search?q=..." (construct a search URL for the title),
            "source": "prediction"
        }
    ]
}

Example: User saves "Flight to Tokyo".
Suggestions: "Best Ramen in Shinjuku", "Tokyo Metro Map 2024", "Japan Rail Pass Guide".

Output ONLY valid JSON.

User saved: Title="${save.title}", Category="${save.category}", Summary="${save.summary}". Suggest 3 follow-ups.`

        let suggestions: any[] = []
        try {
            const text = await callOpenAI(prompt, { temperature: 0.7, maxTokens: 500, jsonMode: true })
            const parsed = JSON.parse(text || '{}')
            suggestions = parsed.suggestions || parsed.items || []
        } catch (err: any) {
            console.error('OpenAI API error:', err.message)
            return new Response(JSON.stringify({ suggestions: [], error: 'OpenAI API error' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // If not run locally via a direct frontend ping, and we have a valid save ID, update the row
        if (save.id && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            const { error: updateError } = await supabase
                .from('saves')
                .update({ predictions: suggestions })
                .eq('id', save.id)

            if (updateError) {
                console.error('Failed to save predictions to DB:', updateError.message)
            } else {
                console.log(`Saved ${suggestions.length} predictions for save ${save.id}`)
            }
        }

        return new Response(JSON.stringify({ success: true, suggestions }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error('Predictive analysis error:', error.message)
        return new Response(JSON.stringify({ suggestions: [], error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
