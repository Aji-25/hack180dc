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
        const { query } = await req.json()

        if (!query) throw new Error('Query required')

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are a "Deep Research Agent". Your goal is to turn a simple bookmark into a comprehensive knowledge dossier.
            
            Given a topic/title, provide a structured Markdown report with:
            1. 🔍 **The Deep Dive**: Academic or technical context often missed.
            2. ⚔️ **Counter-Argument**: Steelman the opposing view. "Why might this be wrong?"
            3. 🗣️ **The Internet's Take**: Simulate the likely sentiment on Reddit/Hacker News/Twitter.
            4. 📚 **Further Reading**: 3 search terms to learn more.
            
            Be concise but insightful. formatting: standard markdown.`
                    },
                    { role: 'user', content: `Analyze this saved item: "${query}"` }
                ],
                temperature: 0.7,
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('OpenAI API Error:', errorText)
            throw new Error(`OpenAI API Error: ${response.statusText} ${errorText}`)
        }

        const data = await response.json()
        const dossier = data.choices[0].message.content

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
