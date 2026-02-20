// @ts-nocheck
// graph-query: Returns a Neo4j subgraph for visualization.
// Returns projected {nodes, edges} maps — never raw Node objects.
// e.freq is recomputed via COUNT (not stored) to avoid inflation from retries.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { runCypher, isNeo4jConfigured } from '../_shared/neo4j.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Clamped defaults: prevent O(n²) slowdowns
const MAX_LIMIT_NODES = 60
const MIN_EDGE_WEIGHT = 0.3

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const body = await req.json()
        const {
            user_phone,
            limit_nodes = 30,
            min_edge_weight = 0.5,
        } = body

        if (!user_phone) throw new Error('user_phone required')

        // Server-side input clamping
        const limitNodes = Math.min(Math.max(1, limit_nodes), MAX_LIMIT_NODES)
        const minWeight = Math.max(min_edge_weight, MIN_EDGE_WEIGHT)

        if (!isNeo4jConfigured()) {
            return new Response(JSON.stringify({
                nodes: [],
                edges: [],
                message: 'Neo4j not configured yet — add NEO4J_URI and NEO4J_PASSWORD secrets',
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Step 1: Get top N entities by mention frequency (recomputed, not stored)
        const entityRows = await runCypher(`
            MATCH (u:User {phone: $phone})-[:SAVED]->(:Save)-[:MENTIONS]->(e:Entity {user_phone: $phone})
            WITH e, count(*) AS freq
            ORDER BY freq DESC
            LIMIT $limit
            RETURN e.key AS id, e.name AS label, e.type AS type, freq AS size
        `, { phone: user_phone, limit: limitNodes })

        if (entityRows.length === 0) {
            return new Response(JSON.stringify({ nodes: [], edges: [], message: 'No entities found for this user' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const nodes = entityRows.map(r => ({
            id: r.id,
            label: r.label,
            type: r.type || 'other',
            size: r.size,
        }))

        const nodeIds = nodes.map(n => n.id)

        // Step 2: Get CO_OCCURS_WITH edges between those nodes
        // We use IN $nodeIds — avoids cartesian UNWIND for large sets
        const edgeRows = await runCypher(`
            MATCH (e1:Entity {user_phone: $phone})-[r:CO_OCCURS_WITH]-(e2:Entity {user_phone: $phone})
            WHERE e1.key IN $nodeIds AND e2.key IN $nodeIds
              AND e1.key < e2.key
              AND r.weight >= $minWeight
            RETURN e1.key AS source, e2.key AS target, r.weight AS weight
        `, { phone: user_phone, nodeIds, minWeight: minWeight })

        const edges = edgeRows.map(r => ({
            source: r.source,
            target: r.target,
            weight: r.weight,
            type: 'co_occurs',
        }))

        // Step 3: Also include category nodes for context
        const catRows = await runCypher(`
            MATCH (u:User {phone: $phone})-[:SAVED]->(s:Save)-[:IN_CATEGORY]->(cat:Category)
            WITH cat, count(s) AS freq
            RETURN 'cat::' + cat.name AS id, cat.name AS label, 'category' AS type, freq AS size
        `, { phone: user_phone })

        const catNodes = catRows.map(r => ({
            id: r.id, label: r.label, type: r.type, size: r.size
        }))

        return new Response(JSON.stringify({
            nodes: [...nodes, ...catNodes],
            edges,
            meta: {
                entity_count: nodes.length,
                edge_count: edges.length,
                limit_applied: limitNodes,
                min_weight_applied: minWeight,
            },
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (err) {
        console.error('[graph-query] error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
