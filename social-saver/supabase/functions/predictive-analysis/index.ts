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
        const { save } = await req.json() // Expect full save object

        if (!save) throw new Error('Save object required')

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
                        content: `You are a "Minority Report" Predictive Engine.
            User just saved a link. Your job: Anticipate what they need NEXT.
            
            Return a JSON array of 3 suggestion objects:
            {
                "title": "Title of the suggested resource",
                "summary": "Why the user needs this (1 sentence)",
                "category": "Same category as input or related",
                "tags": ["predicted", "tag1"],
                "url": "https://google.com/search?q=..." (construct a search URL for the title),
                "source": "prediction"
            }
            
            Example: User saves "Flight to Tokyo".
            Suggestions: "Best Ramen in Shinjuku", "Tokyo Metro Map 2024", "Japan Rail Pass Guide".
            
            Output ONLY valid JSON.`
                    },
                    {
                        role: 'user',
                        content: `User saved: Title="${save.title}", Category="${save.category}", Summary="${save.summary}". Suggest 3 follow-ups.`
                    }
                ],
                temperature: 0.7,
                response_format: { type: "json_object" }
            }),
        })

        const data = await response.json()
        // json_object mode returns content as json string
        const suggestions = JSON.parse(data.choices[0].message.content).suggestions || JSON.parse(data.choices[0].message.content).items || []

        return new Response(JSON.stringify({ suggestions }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
