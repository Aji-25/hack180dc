// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate embedding using Gemini gemini-embedding-001
async function generateEmbedding(text: string): Promise<number[] | null> {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'models/gemini-embedding-001',
                    content: {
                        parts: [{ text }]
                    },
                }),
            }
        );

        if (!response.ok) {
            console.error('Gemini Embedding Error:', await response.text());
            return null;
        }

        const data = await response.json();
        return data.embedding?.values || null;
    } catch (e) {
        console.error('Embedding generation failed:', e);
        return null;
    }
}

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
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                },
                signal: AbortSignal.timeout(5000),
            });
            const html = await metaRes.text();

            // Attribute-order-agnostic OG tag matching
            const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]
                || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1]
                || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
                || "";
            const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1]
                || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)?.[1]
                || html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]
                || "";

            if (ogTitle) title = ogTitle;
            if (ogDesc) rawText = ogDesc;
        } catch {
            // Keep existing data
        }

        // Call Gemini for classification with retry on 429
        const textForLLM = [title, rawText, save.note].filter(Boolean).join(" | ");
        let llmData: any = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            const llmRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            role: "user",
                            parts: [{
                                text: `Classify this saved link into exactly one category: Fitness, Coding, Food, Travel, Design, Business, Self-Improvement, Other. Return ONLY valid JSON (no markdown, no backticks): { "category": "...", "tags": ["...", ...], "summary": "..." }. Summary should be ≤20 words, actionable: what it is + why it matters. Tags: 3-6 lowercase.\n\nURL: ${save.url}\nSource: ${save.source}\nContent: ${textForLLM.slice(0, 500)}`
                            }]
                        }],
                        generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
                    }),
                }
            );
            if (!llmRes.ok) {
                if (llmRes.status === 429) {
                    await new Promise(r => setTimeout(r, attempt * 1500));
                    continue;
                }
                break; // Non-retryable error
            }
            llmData = await llmRes.json();
            break;
        }
        let category = save.category || "Other";
        let tags = save.tags || [];
        let summary = save.summary || "";

        try {
            const rawText = llmData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            // Strip markdown code fences if present
            const cleanJson = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            category = parsed.category || category;
            tags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : tags;
            summary = parsed.summary || summary;
        } catch {
            // Keep existing
        }

        // Generate Embedding with Gemini
        const textToEmbed = `${title || save.title} ${category} ${summary} ${tags.join(" ")}`;
        const embedding = await generateEmbedding(textToEmbed);

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
