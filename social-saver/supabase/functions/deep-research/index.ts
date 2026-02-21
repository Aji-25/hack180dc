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

// OpenAI call with exponential backoff for 429 errors
async function callOpenAI(prompt: string): Promise<string> {
    let lastError: any
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 4096,
                }),
            })

            if (!res.ok) {
                const errorText = await res.text()
                console.error(`OpenAI error (attempt ${attempt}):`, res.status, errorText)
                if (res.status === 429) {
                    await new Promise(r => setTimeout(r, attempt * 2000))
                    lastError = new Error(`OpenAI 429 rate limited`)
                    continue
                }
                throw new Error(`OpenAI API error: ${res.status}`)
            }

            const data = await res.json()
            return data.choices?.[0]?.message?.content || ''
        } catch (err) {
            lastError = err
            if (err.message?.includes('429')) {
                await new Promise(r => setTimeout(r, attempt * 2000))
                continue
            }
            throw err
        }
    }
    throw lastError
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { query } = await req.json()

        if (!query) throw new Error('Query required')

        const clientIP = req.headers.get('x-forwarded-for') || 'anonymous'
        const allowed = await checkRateLimit(clientIP)
        if (!allowed) {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded. Max 5 research requests per hour.' }), {
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const prompt = `You are a "Deep Research Agent". Your goal is to turn a simple bookmark into a comprehensive knowledge dossier.

Given a topic/title, provide a structured Markdown report with:
1. 🔍 **The Deep Dive**: Academic or technical context often missed.
2. ⚔️ **Counter-Argument**: Steelman the opposing view. "Why might this be wrong?"
3. 🗣️ **The Internet's Take**: Simulate the likely sentiment on Reddit/Hacker News/Twitter.
4. 📚 **Further Reading**: 3 search terms to learn more.

Be concise but insightful. Use standard markdown formatting.

Analyze this saved item: "${query}"`

        const dossier = await callOpenAI(prompt)

        if (!dossier) throw new Error('No response from Gemini')

        return new Response(JSON.stringify({ dossier }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error('[deep-research] error:', error.message)
        // Return friendly response for quota errors so the UI doesn't show a blank 500
        if (error.message?.includes('429')) {
            const fallback = `## ⏳ AI Research Temporarily Unavailable

The Gemini API is currently rate-limited. Here are some quick resources you can use instead:

**🔍 Search for this topic on:**
- [Google Scholar](https://scholar.google.com/scholar?q=${encodeURIComponent(query || '')})
- [Hacker News](https://hn.algolia.com/?q=${encodeURIComponent(query || '')})
- [Reddit](https://www.reddit.com/search/?q=${encodeURIComponent(query || '')})

*The AI deep-dive will be available again in ~1 minute once the API rate limit resets.*`
            return new Response(JSON.stringify({ dossier: fallback }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
