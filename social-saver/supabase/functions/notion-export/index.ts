// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { saves, notionKey, databaseId } = await req.json()

        if (!notionKey || !databaseId) {
            throw new Error('Missing Notion API Key or Database ID')
        }

        const results = []
        let successCount = 0

        // Process a max of 5 (for demo speed/limits) or all if reasonable
        const batch = saves.slice(0, 5)

        for (const save of batch) {
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

            if (response.ok) {
                successCount++
                results.push({ id: save.id, status: 'synced' })
            } else {
                const err = await response.text()
                console.error('Notion Error:', err)
                results.push({ id: save.id, status: 'error', error: err })
            }
        }

        return new Response(JSON.stringify({ success: true, synced: successCount, total: batch.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
