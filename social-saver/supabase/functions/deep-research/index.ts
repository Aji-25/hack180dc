// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
import { callOpenAI } from '../_shared/llm.ts'
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

        const dossier = await callOpenAI(prompt, { temperature: 0.7, maxTokens: 4096, jsonMode: false })

        if (!dossier) throw new Error('OpenAI returned an empty or malformed response')

        return new Response(JSON.stringify({ dossier }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error('[deep-research] error:', error.message)
        // Return friendly response for quota errors so the UI doesn't show a blank 500
        if (error.message?.includes('429')) {
            const fallback = `## ⏳ AI Research Temporarily Unavailable

The AI service is currently rate-limited. Here are some quick resources you can use instead:

**🔍 Search for this topic on:**
- [Google Scholar](https://scholar.google.com/scholar?q=${encodeURIComponent(query || '')})
- [Hacker News](https://hn.algolia.com/?q=${encodeURIComponent(query || '')})
- [Reddit](https://www.reddit.com/search/?q=${encodeURIComponent(query || '')})

*Please try again later.*`
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
