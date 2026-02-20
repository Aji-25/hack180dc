// @ts-nocheck
// graph-related-saves: Given an entity identifier, return related saves + structured "why" paths.
// Supports: direct 1-hop + 2-hop via CO_OCCURS_WITH.
// Entity matching is two-stage: exact key/name → prefix + client-side Levenshtein.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { runCypher, isNeo4jConfigured, matchEntityKeys } from '../_shared/neo4j.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const body = await req.json()
        const {
            user_phone,
            entity_name,
            entity_key: inputKey,
            hops = 2,
            limit = 20,
        } = body

        if (!user_phone || (!entity_name && !inputKey)) {
            throw new Error('user_phone and (entity_name or entity_key) required')
        }

        if (!isNeo4jConfigured()) {
            return new Response(JSON.stringify({
                results: [],
                entities_used: [],
                message: 'Neo4j not configured yet',
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Two-stage entity matching
        const searchName = entity_name || inputKey?.split('::').slice(1).join('::') || ''
        let matchedKeys: string[] = []

        if (inputKey) {
            // If key provided directly, verify it exists
            const check = await runCypher(
                `MATCH (e:Entity {key: $key, user_phone: $phone}) RETURN e.key AS key LIMIT 1`,
                { key: inputKey, phone: user_phone }
            )
            matchedKeys = check.length > 0 ? [inputKey] : []
        }

        if (matchedKeys.length === 0 && searchName) {
            matchedKeys = await matchEntityKeys(user_phone, searchName)
        }

        if (matchedKeys.length === 0) {
            return new Response(JSON.stringify({
                results: [],
                entities_used: [],
                graph_debug: { hops, message: `No entity found matching: ${searchName}` },
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const safeLimit = Math.min(limit, 50)
        const allResults: any[] = []
        const seenSaveIds = new Set<string>()

        // Direct 1-hop: saves that directly mention the entities
        const directRows = await runCypher(`
            MATCH (e:Entity {user_phone: $phone})
            WHERE e.key IN $entity_keys
            MATCH (s:Save)-[:MENTIONS]->(e)
            MATCH (u:User {phone: $phone})-[:SAVED]->(s)
            RETURN
                s.id        AS save_id,
                s.title     AS title,
                s.summary   AS summary,
                s.url       AS url,
                s.source    AS source,
                1.0         AS score,
                e.name      AS matched_entity,
                null        AS via_entity,
                null        AS edge_weight,
                'direct'    AS path_kind
            LIMIT $limit
        `, { phone: user_phone, entity_keys: matchedKeys, limit: safeLimit })

        for (const row of directRows) {
            if (!seenSaveIds.has(row.save_id)) {
                seenSaveIds.add(row.save_id)
                allResults.push(row)
            }
        }

        // 2-hop via CO_OCCURS_WITH (only if hops >= 2)
        if (hops >= 2) {
            const hopRows = await runCypher(`
                MATCH (e1:Entity {user_phone: $phone})
                WHERE e1.key IN $entity_keys
                MATCH (e1)-[r:CO_OCCURS_WITH]-(e2:Entity {user_phone: $phone})
                WHERE r.weight >= 0.5
                MATCH (s:Save)-[:MENTIONS]->(e2)
                MATCH (u:User {phone: $phone})-[:SAVED]->(s)
                RETURN
                    s.id            AS save_id,
                    s.title         AS title,
                    s.summary       AS summary,
                    s.url           AS url,
                    s.source        AS source,
                    round(r.weight * 0.8, 2) AS score,
                    e2.name         AS matched_entity,
                    e1.name         AS via_entity,
                    r.weight        AS edge_weight,
                    'co_occurs'     AS path_kind
                LIMIT $limit
            `, { phone: user_phone, entity_keys: matchedKeys, limit: safeLimit })

            for (const row of hopRows) {
                if (!seenSaveIds.has(row.save_id)) {
                    seenSaveIds.add(row.save_id)
                    allResults.push(row)
                }
            }
        }

        // Sort by score descending
        allResults.sort((a, b) => b.score - a.score)

        // Get entity names for entities_used
        const entityNames = await runCypher(
            `MATCH (e:Entity {user_phone: $phone}) WHERE e.key IN $keys
             RETURN e.name AS name, e.type AS type`,
            { phone: user_phone, keys: matchedKeys }
        )

        return new Response(JSON.stringify({
            results: allResults.slice(0, safeLimit),
            entities_used: entityNames,
            graph_debug: {
                hops,
                matched_entity_keys: matchedKeys,
                retrieved_count: allResults.length,
                direct_count: directRows.length,
            },
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (err) {
        console.error('[graph-related-saves] error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
