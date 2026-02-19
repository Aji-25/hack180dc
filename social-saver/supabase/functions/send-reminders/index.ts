// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { userPhone } = await req.json()
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // For demo: verify user exists and get random old save
        // In production, use precise date range

        const { data: saves, error } = await supabaseClient
            .from('saves')
            .select('*')
            .eq('user_phone', userPhone)
            .limit(50)

        if (error) throw error

        // Pick a random save to remind about
        const randomSave = saves[Math.floor(Math.random() * saves.length)]

        if (!randomSave) {
            return new Response(JSON.stringify({ message: "No saves to remind about." }), { headers: corsHeaders })
        }

        const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
        const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
        const FROM_PHONE = 'whatsapp:+14155238886' // Sandbox

        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
            const body = new URLSearchParams()
            body.append('From', FROM_PHONE)
            body.append('To', userPhone)
            body.append('Body', `⏰ *Spaced Repetition Reminder*\n\nYou saved this a while ago. Time to review?\n\n*${randomSave.title || randomSave.summary?.slice(0, 30) || 'Link'}*\n${randomSave.url}\n\n_Reply "Done" to archive._`)

            const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${btoa(TWILIO_ACCOUNT_SID + ':' + TWILIO_AUTH_TOKEN)}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body
            })

            if (!twilioRes.ok) {
                const err = await twilioRes.text()
                console.error('Twilio Error:', err)
                throw new Error('Twilio send failed')
            }
        } else {
            console.log('Skipping Twilio (no creds). Would send:', randomSave.title)
        }

        return new Response(JSON.stringify({ success: true, reminded: randomSave.title }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
