// @ts-nocheck
// supabase/functions/get-saves/index.ts
// Returns saved items for a user with optional search and category filtering.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
    // CORS
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
        const search = url.searchParams.get("search") || "";
        const category = url.searchParams.get("category") || "";
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");

        let query = supabase
            .from("saves")
            .select("*")
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (phone) {
            query = query.eq("user_phone", phone);
        }

        if (category && category !== "All") {
            query = query.eq("category", category);
        }

        if (search && search.trim()) {
            // Use websearch_to_tsquery for flexible full-text search
            query = query.textSearch("fts", search.trim(), { type: "websearch" });
        }

        const { data, error } = await query;

        if (error) {
            console.error("Query error:", error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: corsHeaders,
            });
        }

        return new Response(JSON.stringify(data || []), {
            status: 200,
            headers: corsHeaders,
        });
    } catch (err) {
        console.error("get-saves error:", err);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: corsHeaders,
        });
    }
});
