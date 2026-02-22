import { serve } from "https://deno.land/std@0.177.1/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const mediaUrl = url.searchParams.get('url');

        if (!mediaUrl || !mediaUrl.startsWith('https://api.twilio.com/')) {
            return new Response('Invalid media URL', { status: 400, headers: corsHeaders });
        }

        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
            console.error('Missing Twilio credentials in environment');
            return new Response('Server configuration error', { status: 500, headers: corsHeaders });
        }

        // Basic Auth for Twilio API
        const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

        const response = await fetch(mediaUrl, {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });

        if (!response.ok) {
            console.error(`Twilio fetch failed: ${response.status} ${response.statusText}`);
            return new Response('Failed to fetch media from Twilio', { status: response.status, headers: corsHeaders });
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const body = await response.arrayBuffer();

        return new Response(body, {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable' // Aggressive caching since Media URLs are immutable
            }
        });

    } catch (err: unknown) {
        console.error('Proxy error:', err);
        return new Response(String(err), { status: 500, headers: corsHeaders });
    }
});
