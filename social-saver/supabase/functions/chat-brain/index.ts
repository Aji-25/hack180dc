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

// Rate limiting: 10 queries per user per hour
async function checkRateLimit(identifier: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { data } = await supabase
        .from('rate_limits')
        .select('request_count')
        .eq('identifier', identifier)
        .eq('endpoint', 'chat-brain')
        .gte('window_start', oneHourAgo)
        .single()

    if (data && data.request_count >= 10) return false

    if (data) {
        await supabase
            .from('rate_limits')
            .update({ request_count: data.request_count + 1 })
            .eq('identifier', identifier)
            .eq('endpoint', 'chat-brain')
            .gte('window_start', oneHourAgo)
    } else {
        await supabase.from('rate_limits').insert({
            identifier,
            endpoint: 'chat-brain',
            request_count: 1,
            window_start: new Date().toISOString(),
        })
    }
    return true
}

// Generate embedding using Gemini gemini-embedding-001
async function generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'models/gemini-embedding-001',
                content: {
                    parts: [{ text }]
                },
            }),
        }
    )

    if (!response.ok) {
        const errorText = await response.text()
        console.error('Gemini Embedding Error:', errorText)
        throw new Error(`Gemini Embedding Error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.embedding.values
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { query } = await req.json()

        if (!query) throw new Error('Query required')

        // Rate limit
        const clientIP = req.headers.get('x-forwarded-for') || 'anonymous'
        const allowed = await checkRateLimit(clientIP)
        if (!allowed) {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded. Max 10 queries per hour.' }), {
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 1. Generate Embedding for Query using Gemini
        const queryEmbedding = await generateEmbedding(query)

        // 2. Search Supabase (Vector Search)
        const { data: contextSaves, error: searchError } = await supabase.rpc('match_saves', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: 8,
        })

        if (searchError) {
            console.error('Vector search error:', searchError)
            // Fallback: do a simple text search if vector search fails
        }

        // 3. Generate Answer using Gemini
        const contextText = contextSaves?.length
            ? contextSaves.map((s: any) => `- [${s.category}] ${s.title}: ${s.summary} (Similarity: ${(s.similarity * 100).toFixed(0)}%)`).join('\n')
            : 'No relevant saves found via vector search.'

        const prompt = `You are a "Second Brain" AI assistant.
User Query: "${query}"

Your goal is to Answer the query using ONLY the provided context (Vector Search Results).
- Reference specific saves by title.
- Synthesize information across multiple saves.
- Be concise and actionable.
- If no relevant saves found, say so honestly.

Context:
${contextText}

Answer the user's query based on the context above.`

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: prompt }]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024,
                    },
                }),
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Gemini API Error: ${response.statusText} ${errorText}`)
        }

        const data = await response.json()
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text

        if (!reply) throw new Error('No response from Gemini')

        return new Response(JSON.stringify({ reply, references: contextSaves || [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
