// @ts-nocheck
// DEMO_KEY auth guard — protects mutating graph endpoints

export function checkDemoKey(req: Request): Response | null {
    const demoKey = Deno.env.get('DEMO_KEY')

    // Fail-closed: if DEMO_KEY is not set, only allow if DEMO_MODE=true is explicitly set.
    // This prevents accidental open access in production when the secret is missing.
    if (!demoKey) {
        if (Deno.env.get('DEMO_MODE') === 'true') {
            console.warn('[auth] DEMO_KEY not configured — allowing all requests (DEMO_MODE=true)')
            return null
        }
        console.error('[auth] DEMO_KEY not configured and DEMO_MODE != true — blocking request')
        return new Response(JSON.stringify({ error: 'Forbidden: server misconfiguration' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
    }

    const provided = req.headers.get('X-DEMO-KEY') ?? ''

    // Timing-safe comparison to prevent character-by-character brute-force
    const encoder = new TextEncoder()
    const keyA = encoder.encode(provided.padEnd(demoKey.length, '\0'))
    const keyB = encoder.encode(demoKey.padStart(provided.length, '\0').slice(0, keyA.length))
    // XOR every byte; result is 0 only if all bytes match
    let diff = provided.length !== demoKey.length ? 1 : 0
    for (let i = 0; i < keyA.length; i++) diff |= keyA[i] ^ keyB[i]

    if (diff !== 0) {
        return new Response(JSON.stringify({ error: 'Forbidden: invalid X-DEMO-KEY' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
    }
    return null
}
