// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting: 5 research requests per user per hour
async function checkRateLimit(identifier: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { data } = await supabase
        .from('rate_limits')
        .select('request_count')
        .eq('identifier', identifier)
        .eq('endpoint', 'deep-research')
        .gte('window_start', oneHourAgo)
        .single()

    if (data && data.request_count >= 5) return false

    if (data) {
        await supabase
            .from('rate_limits')
            .update({ request_count: data.request_count + 1 })
            .eq('identifier', identifier)
            .eq('endpoint', 'deep-research')
            .gte('window_start', oneHourAgo)
    } else {
        await supabase.from('rate_limits').insert({
            identifier,
            endpoint: 'deep-research',
            request_count: 1,
            window_start: new Date().toISOString(),
        })
    }
    return true
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { query } = await req.json()

        if (!query) throw new Error('Query required')

        // Rate limit by IP or a simple identifier
        const clientIP = req.headers.get('x-forwarded-for') || 'anonymous'
        const allowed = await checkRateLimit(clientIP)
        if (!allowed) {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded. Max 5 research requests per hour.' }), {
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Call Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [{
                                text: `You are a "Deep Research Agent". Your goal is to turn a simple bookmark into a comprehensive knowledge dossier.

Given a topic/title, provide a structured Markdown report with:
1. 🔍 **The Deep Dive**: Academic or technical context often missed.
2. ⚔️ **Counter-Argument**: Steelman the opposing view. "Why might this be wrong?"
3. 🗣️ **The Internet's Take**: Simulate the likely sentiment on Reddit/Hacker News/Twitter.
4. 📚 **Further Reading**: 3 search terms to learn more.

Be concise but insightful. formatting: standard markdown.

Analyze this saved item: "${query}"`
                            }]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 4096,
                    },
                }),
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Gemini API Error:', errorText)
            throw new Error(`Gemini API Error: ${response.statusText}`)
        }

        const data = await response.json()
        const dossier = data.candidates?.[0]?.content?.parts?.[0]?.text

        if (!dossier) throw new Error('No response from Gemini')

        return new Response(JSON.stringify({ dossier }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
