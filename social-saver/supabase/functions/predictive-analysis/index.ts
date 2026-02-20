// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

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

        if (!GEMINI_API_KEY) {
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

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        responseMimeType: 'application/json',
                    },
                }),
            }
        )

        const data = await response.json()

        if (!response.ok) {
            console.error('Gemini API error:', JSON.stringify(data))
            return new Response(JSON.stringify({ suggestions: [], error: 'Gemini API error' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
        const parsed = JSON.parse(text)
        const suggestions = parsed.suggestions || parsed.items || []

        return new Response(JSON.stringify({ suggestions }), {
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
