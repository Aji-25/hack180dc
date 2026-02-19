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
        const { id } = await req.json();
        if (!id) {
            return new Response(JSON.stringify({ error: "id required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Fetch the save
        const { data: save, error: fetchErr } = await supabase
            .from("saves")
            .select("*")
            .eq("id", id)
            .single();

        if (fetchErr || !save) {
            return new Response(JSON.stringify({ error: "Save not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Try to fetch OG metadata
        let title = save.title || "";
        let rawText = save.raw_text || "";

        try {
            const metaRes = await fetch(save.url, {
                headers: { "User-Agent": "Mozilla/5.0 (compatible; SocialSaverBot/1.0)" },
                signal: AbortSignal.timeout(5000),
            });
            const html = await metaRes.text();

            const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                html.match(/<title>([^<]+)<\/title>/i);
            const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i) ||
                html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);

            if (titleMatch) title = titleMatch[1];
            if (descMatch) rawText = descMatch[1];
        } catch {
            // Keep existing data
        }

        // Call LLM
        const textForLLM = [title, rawText, save.note].filter(Boolean).join(" | ");

        const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                temperature: 0.3,
                max_tokens: 200,
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: `Classify this saved link into exactly one category: Fitness, Coding, Food, Travel, Design, Business, Self-Improvement, Other. Return JSON: { "category": "...", "tags": ["...", ...], "summary": "..." }. Summary should be ≤20 words, actionable: what it is + why it matters. Tags: 3-6 lowercase.`,
                    },
                    {
                        role: "user",
                        content: `URL: ${save.url}\nSource: ${save.source}\nContent: ${textForLLM.slice(0, 500)}`,
                    },
                ],
            }),
        });

        const llmData = await llmRes.json();
        let category = save.category || "Other";
        let tags = save.tags || [];
        let summary = save.summary || "";

        try {
            const parsed = JSON.parse(llmData.choices[0].message.content);
            category = parsed.category || category;
            tags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : tags;
            summary = parsed.summary || summary;
        } catch {
            // Keep existing
        }

        // Generate Embedding
        let embedding = null;
        try {
            const textToEmbed = `${title || save.title} ${category} ${summary} ${tags.join(" ")}`;
            const embeddingRes = await fetch("https://api.openai.com/v1/embeddings", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "text-embedding-3-small",
                    input: textToEmbed,
                }),
            });
            const embData = await embeddingRes.json();
            if (embData.data?.[0]?.embedding) {
                embedding = embData.data[0].embedding;
            }
        } catch (e) {
            console.error("Embedding generation failed:", e);
        }

        // Update the save
        const updatePayload: any = {
            title: title || save.title,
            raw_text: rawText || save.raw_text,
            category,
            tags,
            summary,
            status: "complete",
            error_msg: null,
        };
        if (embedding) updatePayload.embedding = embedding;

        const { error: updateErr } = await supabase
            .from("saves")
            .update(updatePayload)
            .eq("id", id);

        if (updateErr) throw updateErr;

        return new Response(
            JSON.stringify({ success: true, category, tags, summary }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("Retry error:", err);
        return new Response(
            JSON.stringify({ error: "Retry failed" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
