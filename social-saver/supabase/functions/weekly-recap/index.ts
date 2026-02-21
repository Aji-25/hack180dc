// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const url = new URL(req.url);
        const phone = url.searchParams.get("phone");

        if (!phone) {
            return new Response(JSON.stringify({ error: "phone required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Fetch last 7 days of saves
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const { data: saves, error } = await supabase
            .from("saves")
            .select("category, tags, summary, source, note, created_at")
            .eq("user_phone", phone)
            .gte("created_at", weekAgo)
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!saves || saves.length === 0) {
            return new Response(
                JSON.stringify({
                    recap: [
                        "No saves this week — send some links to get started!",
                    ],
                    period: "This week",
                    count: 0,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Build context for LLM
        const catCounts: Record<string, number> = {};
        const allTags: Record<string, number> = {};
        saves.forEach((s: any) => {
            catCounts[s.category] = (catCounts[s.category] || 0) + 1;
            (s.tags || []).forEach((t: string) => {
                allTags[t] = (allTags[t] || 0) + 1;
            });
        });

        const topTags = Object.entries(allTags)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([t]) => t);

        const catSummary = Object.entries(catCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([c, n]) => `${n} ${c}`)
            .join(", ");

        const summaries = saves
            .filter((s: any) => s.summary)
            .map((s: any) => s.summary)
            .slice(0, 15)
            .join("; ");

        // One LLM call using OpenAI
        const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: `You generate weekly recap summaries for a link-saving app. Be conversational, warm, and specific. Return JSON: { "bullets": ["...", "...", "...", "...", "..."] } — exactly 5 bullets.\n\nUser saved ${saves.length} links this week.\nCategories: ${catSummary}.\nTop tags: ${topTags.join(", ")}.\nSample summaries: ${summaries}.\n\nGenerate a 5-bullet weekly recap:\n1) A summary line like "You saved X links: Y Fitness, Z Food…"\n2) Top themes you noticed across the saves\n3) An interesting pattern or insight\n4) A suggestion for what to explore next\n5) A motivational or fun closing line` }],
                temperature: 0.7,
                max_tokens: 500,
                response_format: { type: 'json_object' },
            })
        });

        const llmData = await llmRes.json();
        let bullets: string[] = [];

        try {
            const text = llmData.choices?.[0]?.message?.content || "{}";
            const parsed = JSON.parse(text);
            bullets = parsed.bullets || [];
        } catch {
            bullets = [
                `You saved ${saves.length} links this week: ${catSummary}.`,
                `Top tags: ${topTags.slice(0, 5).join(", ")}.`,
                "Keep saving — your collection is growing!",
            ];
        }

        return new Response(
            JSON.stringify({
                recap: bullets,
                period: "This week",
                count: saves.length,
                categories: catCounts,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("Recap error:", err);
        return new Response(
            JSON.stringify({ error: "Failed to generate recap" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
