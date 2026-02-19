// @ts-nocheck
// supabase/functions/whatsapp-webhook/index.ts
// Twilio WhatsApp webhook handler — receives messages, extracts URLs,
// calls Gemini for categorization, saves to Supabase, replies via TwiML.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { Readability } from "https://esm.sh/@mozilla/readability@0.4.4";
import { YoutubeTranscript } from "https://esm.sh/youtube-transcript";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://social-saver.vercel.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CATEGORIES = [
    "Fitness", "Coding", "Food", "Travel",
    "Design", "Business", "Self-Improvement", "Other",
];

const CATEGORY_EMOJIS: Record<string, string> = {
    Fitness: "💪", Coding: "💻", Food: "🍳", Travel: "✈️",
    Design: "🎨", Business: "💼", "Self-Improvement": "🧠", Other: "📌",
};

// ── Helpers ──────────────────────────────────────────────

function extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;
    const matches = text.match(urlRegex) || [];
    return [...new Set(matches.map((u) => u.replace(/[.,;:!?)]+$/, "")))];
}

function detectSource(url: string): string {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("instagram.com") || hostname.includes("instagr.am")) return "instagram";
    if (hostname.includes("twitter.com") || hostname.includes("x.com") || hostname.includes("t.co")) return "x";
    if (hostname.includes("medium.com") || hostname.includes("dev.to") || hostname.includes("substack.com")) return "blog";
    return "other";
}

async function fetchMetadata(url: string): Promise<{ title: string; description: string }> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const res = await fetch(url, {
            signal: controller.signal,
            headers: { "User-Agent": "Mozilla/5.0 (compatible; SocialSaverBot/1.0)" },
            redirect: "follow",
        });
        clearTimeout(timeout);

        const html = await res.text();

        const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] || "";
        const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] || "";
        const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";

        return {
            title: ogTitle || titleTag || "",
            description: ogDesc || "",
        };
    } catch {
        return { title: "", description: "" };
    }
}

function extractVideoId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

async function fetchContent(url: string): Promise<string | null> {
    try {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = extractVideoId(url);
            if (videoId) {
                try {
                    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
                    const text = transcriptItems.map(t => t.text).join(' ');
                    return text.slice(0, 20000);
                } catch (err) {
                    console.error('YouTube transcript failed:', err);
                }
            }
        }

        if (url.includes('instagram.com') || url.includes('twitter.com') || url.includes('x.com') || url.includes('tiktok.com')) {
            return null;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
        });
        clearTimeout(timeout);

        if (!res.ok) return null;

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        if (!doc) return null;

        const reader = new Readability(doc);
        const article = reader.parse();
        return article?.textContent ? article.textContent.trim().slice(0, 20000) : null;

    } catch (e) {
        console.error('Content scraping failed:', e);
        return null;
    }
}

// ── Gemini API Helpers ──────────────────────────────────

async function callGemini(prompt: string, options: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {}): Promise<string> {
    const { temperature = 0.3, maxTokens = 300, jsonMode = false } = options;

    const body: any = {
        contents: [
            {
                role: 'user',
                parts: [{ text: prompt }]
            }
        ],
        generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
        },
    };

    if (jsonMode) {
        body.generationConfig.responseMimeType = 'application/json';
    }

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }
    );

    if (!res.ok) {
        console.error("Gemini error:", res.status, await res.text());
        throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

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

// ── Classification ──────────────────────────────────────

async function classifyWithLLM(
    url: string,
    source: string,
    title: string,
    description: string,
    userNote: string,
): Promise<{ category: string; tags: string[]; summary: string; action_steps: string[] }> {
    const fallback = { category: "Other", tags: [], summary: `Saved ${source} link`, action_steps: [] };

    try {
        const isReel = url.includes("/reel/") || url.includes("/reels/");
        const isPost = url.includes("/p/");

        const prompt = `You are a content categorizer for saved social media links. Output a JSON object with exactly these fields:
- "category": exactly one of [${CATEGORIES.join(", ")}]
- "tags": array of 3-6 lowercase keyword tags relevant to the content
- "summary": one concise sentence (max 20 words) in format "What it is—why it matters." Example: "5-min core circuit using planks—great for quick daily strength."
- "action_steps": array of 2-4 short actionable bullets ONLY for Fitness, Food, or Coding categories. For Fitness: exercises/reps. For Food: key ingredients/steps. For Coding: concepts/commands. For other categories, use empty array [].

Rules:
- If metadata is sparse, infer from URL structure and source type.
- ${isReel ? 'This is a video Reel (short-form video).' : isPost ? 'This is an image/carousel post.' : ''}
- If insufficient info, use category="Other" and summary="Saved link (add a note to improve)."
- Never invent specific claims you can't verify from the given info.
- Always respond with valid JSON only. No markdown, no extra text.

URL: ${url}
Source: ${source}
Title: ${title || "(none)"}
Description: ${description || "(none)"}
User note: ${userNote || "(none)"}`;

        const content = await callGemini(prompt, { temperature: 0.3, maxTokens: 250, jsonMode: true });
        if (!content) return fallback;

        const parsed = JSON.parse(content);

        const category = CATEGORIES.includes(parsed.category) ? parsed.category : "Other";
        const tags = Array.isArray(parsed.tags)
            ? parsed.tags.filter((t: unknown) => typeof t === "string").slice(0, 8)
            : [];
        const summary = typeof parsed.summary === "string" && parsed.summary.trim()
            ? parsed.summary.trim()
            : `Saved ${source} link`;
        const action_steps = Array.isArray(parsed.action_steps)
            ? parsed.action_steps.filter((s: unknown) => typeof s === "string").slice(0, 4)
            : [];

        return { category, tags, summary, action_steps };
    } catch (err) {
        console.error("LLM error:", err);
        return fallback;
    }
}

// ── Voice → Transcription (graceful fallback) ───────────

async function transcribeAudio(mediaUrl: string): Promise<string> {
    // Gemini doesn't have a direct Whisper equivalent via simple REST
    // Try OpenAI Whisper if key is available, otherwise return empty
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
        console.log("No OPENAI_API_KEY set — voice transcription unavailable");
        return "";
    }

    try {
        const audioRes = await fetch(mediaUrl);
        const audioBlob = await audioRes.blob();

        const form = new FormData();
        form.append("file", audioBlob, "voice.ogg");
        form.append("model", "whisper-1");
        form.append("language", "en");

        const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${openaiKey}` },
            body: form,
        });

        if (!whisperRes.ok) {
            console.error("Whisper error:", whisperRes.status);
            return "";
        }

        const result = await whisperRes.json();
        return result.text || "";
    } catch (err) {
        console.error("Transcription error:", err);
        return "";
    }
}

// ── Image → Gemini Vision description ──────────────────

async function describeImage(mediaUrl: string): Promise<{ title: string; description: string }> {
    try {
        // Download image and convert to base64
        const imageRes = await fetch(mediaUrl);
        const imageBuffer = await imageRes.arrayBuffer();
        const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
        const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';

        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [
                            {
                                inlineData: {
                                    mimeType,
                                    data: base64Image,
                                }
                            },
                            {
                                text: 'Describe this image concisely. Extract: a short title (max 8 words) and a description (max 30 words). If it\'s a book cover, product, screenshot, recipe, or workout — mention that. Return JSON only: { "title": "...", "description": "..." }'
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 200,
                        responseMimeType: 'application/json',
                    },
                }),
            }
        );

        if (!res.ok) {
            console.error("Gemini Vision error:", res.status);
            return { title: "Image save", description: "" };
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const parsed = JSON.parse(text);
        return {
            title: parsed.title || "Image save",
            description: parsed.description || "",
        };
    } catch (err) {
        console.error("Vision error:", err);
        return { title: "Image save", description: "" };
    }
}

function twimlResponse(message: string): Response {
    const safeMsg = message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${safeMsg}</Message>
</Response>`;

    return new Response(xml, {
        status: 200,
        headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
}

// ── Main Handler ─────────────────────────────────────────

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        });
    }

    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const formData = await req.formData();
        const body = (formData.get("Body") as string) || "";
        const from = (formData.get("From") as string) || "";
        const numMedia = parseInt((formData.get("NumMedia") as string) || "0");
        const mediaUrl = (formData.get("MediaUrl0") as string) || "";
        const mediaType = (formData.get("MediaContentType0") as string) || "";

        console.log(`[webhook] From: ${from} | Body: ${body} | Media: ${numMedia} ${mediaType}`);

        if (!from) {
            return twimlResponse("Could not identify sender. Please try again.");
        }

        // ── Voice Note ──────────────────────────────────────
        if (numMedia > 0 && mediaType.startsWith("audio/")) {
            console.log("[webhook] Processing voice note...");
            const transcript = await transcribeAudio(mediaUrl);

            if (!transcript) {
                return twimlResponse("🎙️ Voice notes are currently unavailable. Please send a text or link instead!");
            }

            const classification = await classifyWithLLM("", "voice", "Voice Note", transcript, body);

            await supabase.from("saves").insert({
                user_phone: from,
                url: `voice://${Date.now()}`,
                source: "voice",
                title: "🎙️ Voice Note",
                raw_text: transcript,
                category: classification.category,
                tags: classification.tags,
                summary: classification.summary,
                action_steps: classification.action_steps,
                note: transcript,
                status: "complete",
            });

            const emoji = CATEGORY_EMOJIS[classification.category] || "📌";
            return twimlResponse(
                `🎙️ Voice note saved! ${emoji} ${classification.category}\n` +
                `📝 ${classification.summary}\n\n` +
                `💬 "${transcript.slice(0, 100)}${transcript.length > 100 ? '...' : ''}"\n\n` +
                `🔗 Dashboard: ${APP_URL}/?u=${encodeURIComponent(from)}`
            );
        }

        // ── Image / Photo ───────────────────────────────────
        if (numMedia > 0 && mediaType.startsWith("image/")) {
            console.log("[webhook] Processing image...");
            const imageInfo = await describeImage(mediaUrl);

            const classification = await classifyWithLLM(
                mediaUrl, "image", imageInfo.title, imageInfo.description, body
            );

            await supabase.from("saves").insert({
                user_phone: from,
                url: mediaUrl,
                source: "image",
                title: imageInfo.title,
                raw_text: imageInfo.description,
                category: classification.category,
                tags: classification.tags,
                summary: classification.summary,
                action_steps: classification.action_steps,
                note: body || null,
                status: "complete",
            });

            const emoji = CATEGORY_EMOJIS[classification.category] || "📌";
            return twimlResponse(
                `📸 Image saved! ${emoji} ${classification.category}\n` +
                `📝 ${classification.summary}\n\n` +
                `🔗 Dashboard: ${APP_URL}/?u=${encodeURIComponent(from)}`
            );
        }

        // Extract URLs from message
        const urls = extractUrls(body);

        // ── No URLs found: check for pending note ──
        if (urls.length === 0) {
            const noteText = body.trim();

            const { data: pending } = await supabase
                .from("saves")
                .select("*")
                .eq("user_phone", from)
                .eq("status", "pending_note")
                .order("created_at", { ascending: false })
                .limit(1);

            if (pending && pending.length > 0) {
                const row = pending[0];

                if (noteText.toLowerCase() === "skip") {
                    await supabase
                        .from("saves")
                        .update({ status: "complete" })
                        .eq("id", row.id);

                    return twimlResponse("Got it! Saved without a note. ✅");
                }

                const result = await classifyWithLLM(row.url, row.source, row.title || "", row.raw_text || "", noteText);

                await supabase
                    .from("saves")
                    .update({
                        note: noteText,
                        category: result.category,
                        tags: result.tags,
                        summary: result.summary,
                        status: "complete",
                    })
                    .eq("id", row.id);

                const emoji = CATEGORY_EMOJIS[result.category] || "📌";
                return twimlResponse(
                    `Note added & re-categorized! ${emoji}\n` +
                    `📂 ${result.category}\n` +
                    `📝 ${result.summary}\n\n` +
                    `🔗 Dashboard: ${APP_URL}/?u=${encodeURIComponent(from)}`
                );
            }

            return twimlResponse(
                "👋 Hey! Send me an Instagram (or any) link and I'll save it to your dashboard.\n\n" +
                `🔗 Your dashboard: ${APP_URL}/?u=${encodeURIComponent(from)}`
            );
        }

        // ── Process each URL ──
        const results: string[] = [];

        for (const url of urls) {
            try {
                const source = detectSource(url);
                const metadata = await fetchMetadata(url);
                const hasMetadata = !!(metadata.title || metadata.description);
                const content = await fetchContent(url);

                const classification = await classifyWithLLM(
                    url, source, metadata.title, metadata.description, (content || "").slice(0, 1000)
                );

                const status = hasMetadata ? "complete" : "pending_note";

                const embedContent = `${metadata.title || ''} ${classification.category} ${classification.summary} ${(content || "").slice(0, 4000)}`;

                const { data, error } = await supabase
                    .from("saves")
                    .upsert(
                        {
                            user_phone: from,
                            url,
                            source,
                            title: metadata.title || null,
                            raw_text: metadata.description || null,
                            content: content || null,
                            category: classification.category,
                            tags: classification.tags,
                            summary: classification.summary,
                            status,
                        },
                        { onConflict: "user_phone,url_hash", ignoreDuplicates: false }
                    )
                    .select()
                    .single();

                if (error) {
                    console.error("Supabase insert error:", error);
                    results.push(`⚠️ Error saving: ${url}`);
                    continue;
                }

                // Generate Embedding with Gemini
                if (data?.id) {
                    const embedding = await generateEmbedding(embedContent.slice(0, 2000));
                    if (embedding) {
                        await supabase.from('saves').update({ embedding }).eq('id', data.id);
                    }
                }

                const emoji = CATEGORY_EMOJIS[classification.category] || "📌";
                results.push(
                    `✅ Saved! ${emoji} ${classification.category}\n` +
                    `📝 ${classification.summary}`
                );

                if (status === "pending_note") {
                    results.push(
                        `\n💡 Couldn't fetch details for this link. Reply with a short note about it, or say "skip".`
                    );
                }
            } catch (err) {
                console.error(`Error processing ${url}:`, err);

                try {
                    await supabase.from("saves").upsert(
                        {
                            user_phone: from,
                            url,
                            source: detectSource(url),
                            category: "Other",
                            tags: [],
                            summary: "Saved link (processing failed)",
                            status: "error",
                            error_msg: String(err),
                        },
                        { onConflict: "user_phone,url_hash", ignoreDuplicates: false }
                    );
                } catch { /* never crash */ }

                results.push(`⚠️ Saved ${url} but couldn't process. You can add a note later.`);
            }
        }

        const reply = results.join("\n\n") +
            `\n\n🔗 Dashboard: ${APP_URL}/?u=${encodeURIComponent(from)}`;

        return twimlResponse(reply);
    } catch (err) {
        console.error("[webhook] Fatal error:", err);
        return twimlResponse("Something went wrong, but don't worry — try again!");
    }
});
