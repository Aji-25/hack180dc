// bulk_import.js — paste your links into the LINKS array below and run:
// export SUPABASE_SERVICE_ROLE_KEY=... && export OPENAI_API_KEY=... && node bulk_import.js

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://hxiwxeihlobarzphvvqi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// This is the sha256 hash of "whatsapp:+919391219400" (the step-camp sandbox number)
// It IS the user_phone for ALL inserts
const USER_PHONE = '5875284806cb2e2cd928b6dff55ad0854811295bb14ac31c2fd8442fddd3703f';

// ── PASTE YOUR LINKS HERE ────────────────────────────────────────────────────
const LINKS = [
    "https://www.instagram.com/mrwhosetheboss/reel/DTtBMmNDLxS/",
    "https://www.instagram.com/mrwhosetheboss/reel/DTSzf0nDF2h/",
    "https://www.instagram.com/mrwhosetheboss/reel/DUTMdhzDBIS/",
    "https://www.instagram.com/mrwhosetheboss/reel/C1PSjWWMKpa/",
    "https://www.instagram.com/mrwhosetheboss/reel/DOtFZyLDOvC/",
    "https://www.instagram.com/mrwhosetheboss/reel/DOyqSYDjewO/",
    "https://www.instagram.com/mrwhosetheboss/reel/DRtzj93DNjf/",
    "https://www.instagram.com/mrwhosetheboss/reel/DNQKB-KMfJN/",
    "https://www.instagram.com/mrwhosetheboss/reel/DNp7VkMM09a/",
    "https://www.instagram.com/mrwhosetheboss/reel/DND7wi1MiLP/",
    "https://www.instagram.com/mrwhosetheboss/reel/DLzwGgUINDz/",
    "https://www.instagram.com/mrwhosetheboss/reel/DLUfHYpsWBO/",
];
// ────────────────────────────────────────────────────────────────────────────

const CATEGORIES = ["Fitness", "Coding", "Food", "Travel", "Design", "Business", "Self-Improvement", "Other"];
const CATEGORY_EMOJIS = { Fitness: "💪", Coding: "💻", Food: "🍳", Travel: "✈️", Design: "🎨", Business: "💼", "Self-Improvement": "🧠", Other: "📌" };

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function detectSource(url) {
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'x';
    if (url.includes('reddit.com')) return 'reddit';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('linkedin.com')) return 'linkedin';
    return 'web';
}

async function fetchMetadata(url) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'facebookexternalhit/1.1' },
            signal: AbortSignal.timeout(6000),
        });
        const html = await res.text();
        const title = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || '';
        const description = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1] || '';
        return { title, description };
    } catch {
        return { title: '', description: '' };
    }
}

async function classifyURL(url, source, title, description) {
    try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                max_tokens: 200,
                messages: [
                    {
                        role: 'system',
                        content: `You are a content classifier. Return JSON with:
- category: one of ${CATEGORIES.join(', ')}
- tags: array of 3-5 relevant lowercase tags
- summary: 1-2 sentences describing the content
- title: a short descriptive title (max 60 chars)
Return ONLY valid JSON, no markdown.`,
                    },
                    { role: 'user', content: `URL: ${url}\nSource: ${source}\nTitle: ${title}\nDescription: ${description}` },
                ],
            }),
        });
        const data = await resp.json();
        const text = data.choices?.[0]?.message?.content || '{}';
        return JSON.parse(text);
    } catch {
        return { category: 'Other', tags: [source], summary: 'Saved link.', title: title || null };
    }
}


async function generateEmbedding(text) {
    try {
        const resp = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
            body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 2000) }),
        });
        const data = await resp.json();
        return data.data?.[0]?.embedding || null;
    } catch {
        return null;
    }
}

async function run() {
    if (LINKS.length === 0) {
        console.error('❌ No links found! Add URLs to the LINKS array.');
        process.exit(1);
    }
    console.log(`🚀 Importing ${LINKS.length} links under user hash: ${USER_PHONE.slice(0, 10)}...`);

    let success = 0, failed = 0;

    for (let i = 0; i < LINKS.length; i++) {
        const url = LINKS[i].trim();
        if (!url) continue;

        process.stdout.write(`[${i + 1}/${LINKS.length}] ${url.slice(0, 60)}... `);

        try {
            const source = detectSource(url);
            const meta = await fetchMetadata(url);
            const classification = await classifyURL(url, source, meta.title, meta.description);

            const embedInput = `${classification.title || ''} ${classification.category} ${classification.summary} ${(classification.tags || []).join(' ')}`;
            const embedding = await generateEmbedding(embedInput);

            const { data, error } = await supabase
                .from('saves')
                .upsert({
                    user_phone: USER_PHONE,
                    url,
                    source,
                    title: classification.title || null,
                    category: classification.category || 'Other',
                    tags: classification.tags || [source],
                    summary: classification.summary || 'Saved link.',
                    status: 'complete',
                    embedding,
                }, { onConflict: 'user_phone,url_hash', ignoreDuplicates: true })
                .select('id')
                .single();

            if (error) {
                console.log(`❌ DB error: ${error.message}`);
                failed++;
            } else {
                console.log(`✅ ${classification.category} — ${classification.title || 'untitled'}`);
                success++;
            }
        } catch (err) {
            console.log(`❌ Error: ${err.message}`);
            failed++;
        }

        // Small delay to avoid OpenAI rate limits
        await new Promise(r => setTimeout(r, 300));
    }

    console.log(`\n📊 Done! ${success} saved, ${failed} failed.`);
    console.log(`🔗 Dashboard: https://hack180dc.vercel.app/?u=${USER_PHONE}`);
}

run();
