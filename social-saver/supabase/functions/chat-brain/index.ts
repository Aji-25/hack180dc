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

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { query } = await req.json()

        if (!query) throw new Error('Query required')

        // 1. Generate Embedding for Query
        const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: query,
            }),
        })
        const embeddingData = await embeddingRes.json()
        const queryEmbedding = embeddingData.data[0].embedding

        // 2. Search Supabase (Vector Search)
        const { data: contextSaves, error: searchError } = await supabase.rpc('match_saves', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5, // adjust based on results
            match_count: 8,
        })

        if (searchError) throw searchError

        // 3. Generate Answer
        const systemPrompt = `You are a "Second Brain" AI assistant.
User Query: "${query}"

Your goal is to Answer the query using ONLY the provided context (Vector Search Results).
- You have access to these semantic matches from the user's database.
- Reference specific saves by title.
- Synthesize information across multiple saves.
- Be concise and actionable.

Context:
${contextSaves?.map((s: any) => `- [${s.category}] ${s.title}: ${s.summary} (Similarity: ${(s.similarity * 100).toFixed(0)}%)`).join('\n') || 'No relevant saves found.'}
`

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: query }
                ],
                temperature: 0.7,
            }),
        })

        const data = await response.json()
        const reply = data.choices[0].message.content

        return new Response(JSON.stringify({ reply, references: contextSaves }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
