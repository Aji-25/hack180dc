// @ts-nocheck
// supabase/functions/_shared/llm.ts

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

export async function callOpenAI(prompt: string, options: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {}): Promise<string> {
    const { temperature = 0.3, maxTokens = 500, jsonMode = false } = options;

    const body: any = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
    };

    if (jsonMode) body.response_format = { type: 'json_object' };

    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const text = await res.text();
                console.error(`OpenAI error (Attempt ${attempt}):`, res.status, text);
                if (res.status === 429) {
                    await new Promise(r => setTimeout(r, attempt * 1500));
                    lastError = new Error(`OpenAI API 429: ${text}`);
                    continue;
                }
                throw new Error(`OpenAI API error: ${res.status}`);
            }

            const data = await res.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (error: any) {
            lastError = error;
            if (error?.message?.includes('429')) {
                await new Promise(r => setTimeout(r, attempt * 1500));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
    try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: text.slice(0, 8000),
            }),
        });

        if (!response.ok) {
            console.error('OpenAI Embedding Error:', await response.text());
            return null;
        }

        const data = await response.json();
        return data.data?.[0]?.embedding || null;
    } catch (e) {
        console.error('Embedding generation failed:', e);
        return null;
    }
}

export async function transcribeAudio(mediaUrl: string): Promise<string> {
    try {
        // Fetch audio from Twilio URL (requires auth)
        const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
        const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
        const audioRes = await fetch(mediaUrl, {
            headers: {
                'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
            },
        });

        if (!audioRes.ok) {
            console.error('[whisper] Failed to download audio:', audioRes.status);
            return '';
        }

        const audioBuffer = await audioRes.arrayBuffer();
        const contentType = audioRes.headers.get('content-type') || 'audio/ogg';
        const ext = contentType.includes('mp4') ? 'mp4' : contentType.includes('ogg') ? 'ogg' : 'mp3';

        // Build multipart form for Whisper
        const formData = new FormData();
        formData.append('file', new Blob([audioBuffer], { type: contentType }), `audio.${ext}`);
        formData.append('model', 'whisper-1');
        // Omit 'language' so Whisper auto-detects — supports multilingual voice notes

        const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
            body: formData,
        });

        if (!whisperRes.ok) {
            console.error('[whisper] Error:', await whisperRes.text());
            return '';
        }

        const result = await whisperRes.json();
        return result.text || '';
    } catch (err) {
        console.error('[whisper] Transcription failed:', err);
        return '';
    }
}

export async function describeImage(mediaUrl: string): Promise<{ title: string; description: string }> {
    try {
        // Download image and convert to base64
        const imageRes = await fetch(mediaUrl);
        const imageBuffer = await imageRes.arrayBuffer();
        const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
        const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                max_tokens: 200,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
                        { type: 'text', text: 'Describe this image concisely. Return ONLY JSON: { "title": "short title max 8 words", "description": "max 30 words" }' },
                    ],
                }],
                response_format: { type: 'json_object' },
            }),
        });

        if (!res.ok) {
            console.error("GPT Vision error:", res.status);
            return { title: "Image save", description: "" };
        }

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || "{}";
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
