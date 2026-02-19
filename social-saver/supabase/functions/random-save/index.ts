// @ts-nocheck
// supabase/functions/random-save/index.ts
// Returns a random saved item for a given user phone.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json",
    };

    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const phone = url.searchParams.get("phone") || "";

        // Get total count for this user
        let countQuery = supabase
            .from("saves")
            .select("*", { count: "exact", head: true })
            .eq("status", "complete");

        if (phone) {
            countQuery = countQuery.eq("user_phone", phone);
        }

        const { count } = await countQuery;

        if (!count || count === 0) {
            return new Response(JSON.stringify(null), {
                status: 200,
                headers: corsHeaders,
            });
        }

        // Pick random offset
        const randomOffset = Math.floor(Math.random() * count);

        let query = supabase
            .from("saves")
            .select("*")
            .eq("status", "complete")
            .range(randomOffset, randomOffset);

        if (phone) {
            query = query.eq("user_phone", phone);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Random query error:", error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: corsHeaders,
            });
        }

        return new Response(JSON.stringify(data?.[0] || null), {
            status: 200,
            headers: corsHeaders,
        });
    } catch (err) {
        console.error("random-save error:", err);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: corsHeaders,
        });
    }
});
