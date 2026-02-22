// @ts-nocheck
// supabase/functions/whatsapp-webhook/index.ts
// Twilio WhatsApp webhook handler — receives messages, extracts URLs,
// calls OpenAI (GPT-4o-mini + Whisper) for categorization/transcription, saves to Supabase, replies via TwiML.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { Readability } from "https://esm.sh/@mozilla/readability@0.4.4";
import { YoutubeTranscript } from "https://esm.sh/youtube-transcript";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_URL = Deno.env.get("APP_URL") || `https://${Deno.env.get("SUPA_PROJECT_ID")}.supabase.co/functions/v1/whatsapp-webhook`;
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://hack180dc.vercel.app";

import twilio from "npm:twilio";
import { callOpenAI, generateEmbedding, transcribeAudio, describeImage } from "../_shared/llm.ts";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Phone Hashing (SHA-256) ──────────────────────────────────────────────────────────
// Converts raw Twilio phone (e.g. "whatsapp:+919876543210") to a
// 64-char hex SHA-256 hash before persisting to the DB.
// This prevents PII leakage in database exports or logs.
// The dashboard URL sends the hash back to the user, so they can
// bookmark their unique (non-guessable) library URL.
async function hashPhone(phone: string): Promise<string> {
    const normalized = phone.toLowerCase().trim();
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}



const CATEGORIES = [
    "Fitness", "Coding", "Food", "Travel",
    "Design", "Business", "Self-Improvement", "Other",
];

const CATEGORY_EMOJIS: Record<string, string> = {
    Fitness: "💪", Coding: "💻", Food: "🍳", Travel: "✈️",
    Design: "🎨", Business: "💼", "Self-Improvement": "🧠", Other: "📌",
};

// ── Rate limiting ─────────────────────────────────────────
// Uses persistent DB-backed rate limits from _shared/rateLimit.ts
// In-memory cache to avoid redundant DB hits within the same request.
const _rateLimitCache = new Map<string, { allowed: boolean; ts: number }>();

async function isRateLimited(phone: string, endpoint: string): Promise<boolean> {
    const key = `${phone}:${endpoint}`;
    const cached = _rateLimitCache.get(key);
    // Cache result for 5 seconds to avoid duplicate DB calls within a single webhook invocation
    if (cached && Date.now() - cached.ts < 5000) return !cached.allowed;
    const result = await checkRateLimit(phone, endpoint);
    _rateLimitCache.set(key, { allowed: result.allowed, ts: Date.now() });
    return !result.allowed;
}

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
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            },
            redirect: "follow",
        });
        clearTimeout(timeout);

        const html = await res.text();

        // Try multiple patterns for OG tags (attribute order varies)
        const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]
            || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1]
            || "";
        const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1]
            || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)?.[1]
            || "";
        const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";
        const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] || "";

        return {
            title: ogTitle || titleTag || "",
            description: ogDesc || metaDesc || "",
        };
    } catch (e) {
        console.error('fetchMetadata failed:', e);
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

// ── LLM Functions abstracted to _shared/llm.ts ──────────

// ── Smart URL-based fallback (no LLM needed) ───────────

function classifyFromURL(
    url: string,
    source: string,
    title: string,
    description: string,
    userNote: string,
): { category: string; tags: string[]; summary: string; action_steps: string[] } {
    const lower = (url + " " + (title || "") + " " + (description || "") + " " + (userNote || "")).toLowerCase();
    const isReel = url.includes("/reel/") || url.includes("/reels/");
    const isPost = url.includes("/p/");
    const isStory = url.includes("/stories/");

    // Extract username from Instagram URL
    let username = "";
    const igMatch = url.match(/instagram\.com\/([^/?]+)/);
    if (igMatch && !["reel", "reels", "p", "stories", "explore"].includes(igMatch[1])) {
        username = igMatch[1];
    }

    // Detect content type
    const contentType = isReel ? "Reel" : isStory ? "Story" : isPost ? "Post" : "Link";

    // Smart category detection from available text
    const categoryKeywords: Record<string, string[]> = {
        "Fitness": ["workout", "exercise", "gym", "fitness", "yoga", "hiit", "abs", "muscle", "cardio", "strength", "run", "plank", "squat", "deadlift", "protein", "bulk", "cut", "reps", "sets"],
        "Food": ["recipe", "cook", "food", "meal", "eat", "restaurant", "dish", "kitchen", "bake", "ingredient", "dinner", "lunch", "breakfast", "snack", "healthy eating"],
        "Coding": ["code", "programming", "developer", "javascript", "python", "react", "api", "github", "software", "tech", "ai", "machine learning", "web dev", "tutorial", "framework"],
        "Travel": ["travel", "trip", "flight", "hotel", "beach", "mountain", "destination", "explore", "vacation", "tour", "backpack", "bali", "europe", "japan"],
        "Design": ["design", "ui", "ux", "figma", "typography", "logo", "graphic", "creative", "aesthetic", "layout", "portfolio"],
        "Business": ["startup", "business", "entrepreneur", "invest", "money", "finance", "marketing", "sales", "growth", "revenue", "founder", "ceo"],
        "Self-Improvement": ["productivity", "mindset", "habit", "morning routine", "meditation", "journal", "self-help", "motivation", "focus", "discipline", "reading", "book"],
    };

    let detectedCategory = "Other";
    let matchedTags: string[] = [];

    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
        const matched = keywords.filter(kw => lower.includes(kw));
        if (matched.length > matchedTags.length) {
            detectedCategory = cat;
            matchedTags = matched;
        }
    }

    // Build tags — include note keywords too
    const noteTags = userNote
        ? userNote.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !['this', 'that', 'from', 'with', 'just', 'also', 'here', 'want', 'save'].includes(w)).slice(0, 3)
        : [];
    const tags = [...new Set([
        source,
        contentType.toLowerCase(),
        ...(username ? [username] : []),
        ...matchedTags.slice(0, 3),
        ...noteTags,
    ])].slice(0, 6);

    // Build a useful title — prefer username-based title
    const displayTitle = title
        || (username ? `${username}'s ${contentType}` : `${source.charAt(0).toUpperCase() + source.slice(1)} ${contentType}`)
        || `Saved ${source} link`;

    // Build summary — use note as PRIMARY source, it's the most useful context we have
    const cleanNote = userNote?.replace(/^[\s\-–—:]+/, '').trim(); // strip leading "- " or ": "
    const summary = cleanNote
        ? `${cleanNote} — ${contentType.toLowerCase()} saved from ${source}.`
        : description
        || (title ? `${title} — saved from ${source}.`
            : `${displayTitle} — add a note for better categorization.`);

    return { category: detectedCategory, tags, summary, action_steps: [] };
}

// ── Classification ──────────────────────────────────────

async function classifyWithLLM(
    url: string,
    source: string,
    title: string,
    description: string,
    userNote: string,
    phone: string = 'unknown',
): Promise<{ category: string; tags: string[]; summary: string; action_steps: string[] }> {
    // Always have a smart fallback ready (no LLM needed)
    const smartFallback = classifyFromURL(url, source, title, description, userNote);

    // Check per-phone rate limit before calling OpenAI
    if (await isRateLimited(phone, 'classify-llm')) {
        console.log(`[classify] Rate limited for ${phone}, using smart fallback`);
        return smartFallback;
    }
    try {
        const isReel = url.includes("/reel/") || url.includes("/reels/");
        const isPost = url.includes("/p/");

        console.log(`[classify] URL: ${url} | Source: ${source} | Title: "${title}" | Desc: "${description?.slice(0, 50)}" | Note: "${userNote?.slice(0, 50)}"`);

        const prompt = `You are a content categorizer for saved social media links. Output a JSON object with exactly these fields:
- "category": exactly one of [${CATEGORIES.join(", ")}]
- "tags": array of 3-6 lowercase keyword tags relevant to the content
- "summary": one concise sentence (max 20 words) in format "What it is—why it matters." Example: "5-min core circuit using planks—great for quick daily strength."
- "action_steps": array of 2-4 short actionable bullets ONLY for Fitness, Food, or Coding categories. For Fitness: exercises/reps. For Food: key ingredients/steps. For Coding: concepts/commands. For other categories, use empty array [].

Rules:
- ALWAYS generate meaningful output. Even with no metadata, infer from the URL structure (account name, reel ID) and source type.
- ${isReel ? 'This is a video Reel (short-form video).' : isPost ? 'This is an image/carousel post.' : ''}
- Extract the account/creator name from the URL path (e.g. instagram.com/grover.fitness → fitness creator, instagram.com/ksi → entertainer KSI).
- NEVER use "Saved link" or generic placeholders as the summary. Always describe what this content likely is based on any available signals.
- Never invent specific claims you can't verify from the given info.
- Always respond with valid JSON only. No markdown, no extra text.

URL: ${url}
Source: ${source}
Title: ${title || "(none)"}
Description: ${description || "(none)"}
User note: ${userNote || "(none)"}`;

        const content = await callOpenAI(prompt, { temperature: 0.3, maxTokens: 400, jsonMode: true });
        console.log(`[classify] OpenAI raw response: "${content?.slice(0, 200)}"`);
        if (!content) {
            console.log("[classify] Empty OpenAI response, using smart fallback");
            return smartFallback;
        }

        const cleanContent = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleanContent);
        console.log(`[classify] Parsed result: category=${parsed.category}, summary=${parsed.summary?.slice(0, 50)}`);

        const category = CATEGORIES.includes(parsed.category) ? parsed.category : "Other";
        const tags = Array.isArray(parsed.tags)
            ? parsed.tags.filter((t: unknown) => typeof t === "string").slice(0, 8)
            : [];
        const summary = typeof parsed.summary === "string" && parsed.summary.trim()
            ? parsed.summary.trim()
            : smartFallback.summary;
        const action_steps = Array.isArray(parsed.action_steps)
            ? parsed.action_steps.filter((s: unknown) => typeof s === "string").slice(0, 4)
            : [];

        return { category, tags, summary, action_steps };
    } catch (err) {
        console.error("[classify] LLM error, using smart fallback:", err.message);
        return smartFallback;
    }
}



// ── Vision abstracted to _shared/llm.ts ──────────

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

        // ── Twilio Signature Validation ──
        const twilioSignature = req.headers.get("X-Twilio-Signature") || "";
        const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
        const twilioParams: Record<string, string> = {};
        for (const [key, val] of formData.entries()) {
            twilioParams[key] = val.toString();
        }

        // Use the canonical public URL (APP_URL env var) for Twilio signature validation.
        // req.url and x-forwarded-host are unreliable inside Supabase Edge — Twilio signs
        // against the public URL as configured in the Twilio console.
        const urlToValidate = `${WEBHOOK_URL}`;

        const isValid = twilio.validateRequest(
            twilioAuthToken,
            twilioSignature,
            urlToValidate,
            twilioParams
        );

        if (!isValid && Deno.env.get("TWILIO_SKIP_VALIDATION") !== "true") {
            console.error("Invalid Twilio signature — rejecting request.");
            return new Response("Unauthorized", { status: 403 });
        }
        // ────────────────────────────

        const body = (formData.get("Body") as string) || "";
        const from = (formData.get("From") as string) || "";
        const numMedia = parseInt((formData.get("NumMedia") as string) || "0");
        const mediaUrl = (formData.get("MediaUrl0") as string) || "";
        const mediaType = (formData.get("MediaContentType0") as string) || "";

        console.log(`[webhook] From: ${from} | Body: ${body} | Media: ${numMedia} ${mediaType}`);

        if (!from) {
            return twimlResponse("Could not identify sender. Please try again.");
        }

        // Hash the phone number for all DB operations
        const userPhone = await hashPhone(from);

        // ── Voice Note (Whisper) ──────────────────────────────
        if (numMedia > 0 && mediaType.startsWith("audio/")) {
            if (await isRateLimited(from, 'whisper')) {
                return twimlResponse("🎙️ You've reached your daily voice note limit (5/day). Try again tomorrow!");
            }
            console.log("[webhook] Processing voice note via Whisper...");
            const transcript = await transcribeAudio(mediaUrl);

            if (!transcript) {
                return twimlResponse("🎙️ Voice note received but transcription failed. Please try again or send a text instead!");
            }

            const classification = await classifyWithLLM("", "voice", "Voice Note", transcript, body, from);

            const { data: voiceSave } = await supabase.from("saves").insert({
                user_phone: userPhone,
                url: `voice://note-${Date.now()}`,
                source: "voice",
                title: classification.title || "Voice Note",
                raw_text: transcript,
                category: classification.category,
                tags: classification.tags,
                summary: classification.summary,
                action_steps: classification.action_steps,
                note: transcript,
                status: "complete",
                is_deleted: false,
            }).select().single();

            // Non-blocking embedding — don't delay the WhatsApp reply
            if (voiceSave?.id) {
                generateEmbedding(`${transcript} ${classification.summary}`)
                    .then(embedding => {
                        if (embedding) supabase.from('saves').update({ embedding }).eq('id', voiceSave.id)
                    })
                    .catch(err => console.warn('[webhook] voice embedding failed:', err.message))
            }

            const emoji = CATEGORY_EMOJIS[classification.category] || "📌";
            return twimlResponse(
                `🎙️ Voice note saved! ${emoji} ${classification.category}\n` +
                `📝 ${classification.summary}\n\n` +
                `💬 "${transcript.slice(0, 100)}${transcript.length > 100 ? '...' : ''}"\n\n` +
                `🔗 Dashboard: ${FRONTEND_URL}/?u=${encodeURIComponent(userPhone)}`
            );
        }

        // ── Image / Photo ───────────────────────────────────
        if (numMedia > 0 && mediaType.startsWith("image/")) {
            if (await isRateLimited(from, 'vision')) {
                return twimlResponse("📸 You've reached your daily image limit (5/day). Try again tomorrow!");
            }
            console.log("[webhook] Processing image...");

            let finalImageUrl = mediaUrl;
            try {
                // Download from Twilio
                const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
                const mediaRes = await fetch(mediaUrl, { headers: { 'Authorization': `Basic ${auth}` } });

                if (mediaRes.ok) {
                    const blob = await mediaRes.blob();
                    const ext = mediaType.split('/')[1] || 'jpeg';
                    const fileName = `${userPhone}/${Date.now()}.${ext}`;

                    // Upload to Supabase Storage
                    const { data, error } = await supabase.storage
                        .from('whatsapp-media')
                        .upload(fileName, blob, { contentType: mediaType, upsert: true });

                    if (!error && data?.path) {
                        const { data: publicUrlData } = supabase.storage
                            .from('whatsapp-media')
                            .getPublicUrl(data.path);
                        finalImageUrl = publicUrlData.publicUrl;
                    } else {
                        console.error("[webhook] Storage upload failed:", error);
                    }
                } else {
                    console.error(`[webhook] Twilio fetch failed: ${mediaRes.status}`);
                }
            } catch (e) {
                console.error("[webhook] Failed to transfer image to storage:", e);
            }

            const imageInfo = await describeImage(finalImageUrl);

            const classification = await classifyWithLLM(
                finalImageUrl, "image", imageInfo.title, imageInfo.description, body, from
            );

            await supabase.from("saves").insert({
                user_phone: userPhone,
                url: finalImageUrl,
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
                `🔗 Dashboard: ${FRONTEND_URL}/?u=${encodeURIComponent(userPhone)}`
            );
        }

        // Extract URLs from message
        // Extract URLs from message (cap at 3 to avoid credit abuse)
        const urls = extractUrls(body).slice(0, 3);

        // ── No URLs found: check for pending note ──
        if (urls.length === 0) {
            const noteText = body.trim();

            const { data: pending } = await supabase
                .from("saves")
                .select("*")
                .eq("user_phone", userPhone)
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

                const result = await classifyWithLLM(row.url, row.source, row.title || "", row.raw_text || "", noteText, from);

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
                    `🔗 Dashboard: ${FRONTEND_URL}/?u=${encodeURIComponent(userPhone)}`
                );
            }

            return twimlResponse(
                "👋 Hey! Send me an Instagram (or any) link and I'll save it to your dashboard.\n\n" +
                `🔗 Your dashboard: ${FRONTEND_URL}/?u=${encodeURIComponent(userPhone)}`
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

                const contentText = content ? content.slice(0, 1000) : "";
                const mergedDesc = metadata.description || contentText;
                const userNote = body.replace(url, "").trim();

                const classification = await classifyWithLLM(
                    url, source, metadata.title, mergedDesc, userNote, from
                );

                // Always mark complete — GPT now generates meaningful data even without metadata
                const status = "complete";

                const embedContent = `${metadata.title || classification.title || ''} ${classification.category} ${classification.summary} ${(content || "").slice(0, 4000)}`;

                const { data, error } = await supabase
                    .from("saves")
                    .upsert(
                        {
                            user_phone: userPhone,
                            url,
                            source,
                            title: metadata.title || classification.title || null,
                            raw_text: metadata.description || null,
                            content: content || null,
                            category: classification.category,
                            tags: classification.tags,
                            summary: classification.summary,
                            status,
                            is_deleted: false,
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

                if (data?.id) {
                    const embedding = await generateEmbedding(embedContent.slice(0, 2000));
                    if (embedding) {
                        await supabase.from('saves').update({ embedding }).eq('id', data.id);
                    }

                    // Queue this save for Neo4j graph indexing (async — does not block reply)
                    supabase.from('graph_jobs').insert({
                        save_id: data.id,
                        user_phone: userPhone,
                        status: 'pending',
                    }).then(({ error: jobErr }) => {
                        if (jobErr) console.warn('[webhook] graph_jobs insert failed:', jobErr.message)
                    })

                    // Fire and forget predictive analysis
                    const EDGE_FUNCTION_URL = Deno.env.get("EDGE_FUNCTION_URL") || "http://127.0.0.1:54321/functions/v1"
                    fetch(`${EDGE_FUNCTION_URL}/predictive-analysis`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ save: data }),
                    }).catch(e => console.error('[webhook] predictive-analysis trigger failed:', e))
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
                            user_phone: userPhone,
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
            `\n\n🔗 Dashboard: ${FRONTEND_URL}/?u=${encodeURIComponent(userPhone)}`;

        return twimlResponse(reply);
    } catch (err) {
        console.error("[webhook] Fatal error:", err);
        return twimlResponse("Something went wrong, but don't worry — try again!");
    }
});
