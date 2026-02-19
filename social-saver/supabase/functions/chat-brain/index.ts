// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { query, context } = await req.json()

        // context is an array of simplified saves: { title, summary, category, tags }

        const systemPrompt = `You are a helpful AI assistant with access to a user's saved bookmarks (their "second brain").
User Query: "${query}"

Your goal is to Answer the query using ONLY the provided context.
- If the user asks to "draft", "write", "create", or "compose", generate the content based on the context.
- Cite your sources by title if relevant.
- Be concise and actionable.
- If the context doesn't have enough info, say so politely.

Context:
${context.map((s: any) => `- [${s.category}] ${s.title || 'Untitled'}: ${s.summary} (Tags: ${s.tags?.join(', ')})`).join('\n')}
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
                stream: false,
            }),
        })

        const data = await response.json()
        const reply = data.choices[0].message.content

        return new Response(JSON.stringify({ reply }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
