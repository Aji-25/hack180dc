// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Notion API rate limit is ~3 req/s. Batching 10 parallel + 350ms delay is safe.
const BATCH_SIZE = 10
const BATCH_DELAY_MS = 350

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { saves, notionKey, databaseId } = await req.json()

        if (!notionKey || !databaseId) {
            return new Response(
                JSON.stringify({ error: 'Missing Notion API Key or Database ID' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!saves?.length) {
            return new Response(
                JSON.stringify({ success: true, synced: 0, total: 0, results: [] }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const results = []
        let successCount = 0

        // Process in batches of BATCH_SIZE to stay within Notion's rate limits
        for (let i = 0; i < saves.length; i += BATCH_SIZE) {
            const batch = saves.slice(i, i + BATCH_SIZE)

            const batchResults = await Promise.allSettled(
                batch.map(async (save) => {
                    const response = await fetch('https://api.notion.com/v1/pages', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${notionKey}`,
                            'Content-Type': 'application/json',
                            'Notion-Version': '2022-06-28',
                        },
                        body: JSON.stringify({
                            parent: { database_id: databaseId },
                            properties: {
                                Name: {
                                    title: [
                                        { text: { content: save.title || save.summary?.slice(0, 50) || 'Untitled Save' } }
                                    ]
                                },
                                URL: { url: save.url },
                                Category: {
                                    select: { name: save.category || 'Other' }
                                },
                                Tags: {
                                    multi_select: (save.tags || []).slice(0, 10).map((t: string) => ({ name: t.replace(/,/g, '') }))
                                },
                                Summary: {
                                    rich_text: [
                                        { text: { content: save.summary || '' } }
                                    ]
                                },
                                Source: {
                                    select: { name: save.source || 'web' }
                                }
                            }
                        }),
                    })

                    if (!response.ok) {
                        const err = await response.text()
                        throw new Error(err)
                    }
                    return { id: save.id, status: 'synced' }
                })
            )

            batchResults.forEach((result, idx) => {
                if (result.status === 'fulfilled') {
                    successCount++
                    results.push(result.value)
                } else {
                    console.error(`[notion-export] Failed save ${batch[idx]?.id}:`, result.reason?.message)
                    results.push({ id: batch[idx]?.id, status: 'error', error: result.reason?.message })
                }
            })

            // Pause between batches to stay within rate limit (skip after last batch)
            if (i + BATCH_SIZE < saves.length) {
                await sleep(BATCH_DELAY_MS)
            }
        }

        return new Response(
            JSON.stringify({ success: true, synced: successCount, total: saves.length, results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[notion-export] Unhandled error:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
