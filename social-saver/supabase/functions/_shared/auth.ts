// @ts-nocheck
// DEMO_KEY auth guard — protects mutating graph endpoints

export function checkDemoKey(req: Request): Response | null {
    const demoKey = Deno.env.get('DEMO_KEY')
    // If DEMO_KEY is not configured, allow all requests (dev mode)
    if (!demoKey) return null

    const provided = req.headers.get('X-DEMO-KEY')
    if (provided !== demoKey) {
        return new Response(JSON.stringify({ error: 'Forbidden: invalid X-DEMO-KEY' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
    }
    return null
}
