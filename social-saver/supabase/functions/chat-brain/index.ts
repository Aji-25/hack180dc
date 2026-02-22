// @ts-nocheck
// chat-brain: Hybrid Vector + Graph-RAG retrieval.
// Falls back gracefully to vector-only if Neo4j is not configured.
// Returns full retrieval telemetry for debugging and UI display.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
    runCypher, isNeo4jConfigured, matchEntityKeys, normalizeEntityName, entityKey
} from '../_shared/neo4j.ts'
import { checkRateLimit } from '../_shared/rateLimit.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
import { callOpenAI, generateEmbedding } from '../_shared/llm.ts'
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('[chat-brain] Missing required env vars: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── In-Memory LRU Cache ──────────────────────────────────────────────────────
// Survives warm Deno isolate invocations. Cold starts start fresh (expected).
// Caches exact query+phone combos to avoid burning OpenAI tokens on repeats.

const CACHE_MAX = 50
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry { data: unknown; ts: number }
const _queryCache = new Map<string, CacheEntry>()

function _cacheKey(query: string, phone: string): string {
    return `${phone}:${query.trim().toLowerCase()}`
}

function _getCache(key: string): unknown | null {
    const entry = _queryCache.get(key)
    if (!entry) return null
    if (Date.now() - entry.ts > CACHE_TTL_MS) { _queryCache.delete(key); return null }
    return entry.data
}

function _setCache(key: string, data: unknown): void {
    if (_queryCache.size >= CACHE_MAX) {
        // Evict the oldest entry
        const oldest = [..._queryCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]
        if (oldest) _queryCache.delete(oldest[0])
    }
    _queryCache.set(key, { data, ts: Date.now() })
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Rate limiting: 15 queries per phone per day using shared module ──────────



// Query entity + intent extraction
const QUERY_EXTRACT_PROMPT = (query: string) => `Extract entities and intent from this search query for a personal knowledge base.

Query: "${query}"

Return ONLY valid JSON:
{
  "query_entities": [
    {"name": "string", "type": "tool|concept|topic|exercise|food|brand|person|other", "confidence": 0.9}
  ],
  "intent": "find|summarize|compare|draft|plan",
  "require_all": true,
  "filters": {
    "category": null,
    "source": null
  }
}

Rules:
- Extract 1-5 entities max
- Set require_all=true only if the query contains "and" between concepts
- category must be one of: Fitness, Coding, Food, Travel, Design, Business, Self-Improvement, Other — or null
- confidence 0.0-1.0`

async function extractQueryEntities(query: string): Promise<{
    entities: Array<{ name: string; type: string; confidence: number }>;
    intent: string;
    require_all: boolean;
    filters: { category: string | null; source: string | null };
}> {
    try {
        const text = await callOpenAI(QUERY_EXTRACT_PROMPT(query), { temperature: 0.1, maxTokens: 512, jsonMode: true })
        const parsed = JSON.parse(text || '{}')
        return {
            entities: (parsed.query_entities || []).slice(0, 5),
            intent: parsed.intent || 'find',
            require_all: parsed.require_all ?? false,
            filters: parsed.filters || { category: null, source: null },
        }
    } catch (e) {
        console.warn('[chat-brain] entity extraction failed, falling back:', e.message)
        return { entities: [], intent: 'find', require_all: false, filters: { category: null, source: null } }
    }
}

// ── Graph retrieval ──────────────────────────────────────────────────────────
async function graphRetrieval(
    phone: string,
    queryEntities: Array<{ name: string; confidence: number }>,
    requireAll: boolean,
    limit: number = 8
): Promise<{
    saves: any[];
    entityKeys: string[];
    matchedEntityNames: string[];
}> {
    if (!isNeo4jConfigured() || queryEntities.length === 0) {
        return { saves: [], entityKeys: [], matchedEntityNames: [] }
    }

    // Stage 1: match each query entity to Neo4j entity keys
    const matchedKeys: string[] = []
    const matchedNames: string[] = []

    for (const qe of queryEntities) {
        const keys = await matchEntityKeys(phone, qe.name)
        if (keys.length > 0) {
            matchedKeys.push(...keys)
            matchedNames.push(qe.name)
        }
    }

    if (matchedKeys.length === 0) {
        return { saves: [], entityKeys: [], matchedEntityNames: [] }
    }

    const minMatch = requireAll ? Math.min(matchedKeys.length, queryEntities.length) : 1

    // Multi-entity intersection query (AND support)
    const intersectionRows = await runCypher(`
        MATCH (u:User {phone: $phone})-[:SAVED]->(s:Save)
        MATCH (s)-[:MENTIONS]->(e:Entity {user_phone: $phone})
        WHERE e.key IN $entity_keys
        WITH s, collect(DISTINCT e.key) AS matched_keys,
                collect(DISTINCT e.name) AS matched_names
        WHERE size(matched_keys) >= $min_match
        RETURN
            s.id        AS save_id,
            s.title     AS title,
            s.summary   AS summary,
            s.url       AS url,
            s.source    AS source,
            size(matched_keys) AS match_count,
            matched_names AS matched_entities
        ORDER BY match_count DESC
        LIMIT $limit
    `, { phone, entity_keys: matchedKeys, min_match: minMatch, limit })

    // 2-hop expansion for 1-entity queries (find related via co-occurrence)
    let hopRows: any[] = []
    if (!requireAll && matchedKeys.length <= 2) {
        hopRows = await runCypher(`
            MATCH (e1:Entity {user_phone: $phone})
            WHERE e1.key IN $entity_keys
            MATCH (e1)-[r:CO_OCCURS_WITH]-(e2:Entity {user_phone: $phone})
            WHERE r.weight >= 0.8
            MATCH (s:Save)-[:MENTIONS]->(e2)
            MATCH (u:User {phone: $phone})-[:SAVED]->(s)
            RETURN
                s.id            AS save_id,
                s.title         AS title,
                s.summary       AS summary,
                s.url           AS url,
                s.source        AS source,
                round(r.weight * 0.7, 2) AS match_count,
                [e2.name]       AS matched_entities
            LIMIT $limit
        `, { phone, entity_keys: matchedKeys, limit })
    }

    // Deduplicate and merge
    const seen = new Set<string>()
    const saves: any[] = []
    for (const row of [...intersectionRows, ...hopRows]) {
        if (!seen.has(row.save_id)) {
            seen.add(row.save_id)
            saves.push({
                id: row.save_id,
                title: row.title,
                summary: row.summary,
                url: row.url,
                source: row.source,
                graph_score: row.match_count,
                matched_entities: row.matched_entities || [],
                retrieval_source: 'graph',
            })
        }
    }

    return { saves, entityKeys: matchedKeys, matchedEntityNames: matchedNames, hopsRan: hopRows.length > 0 }
}

// ── Answer generation ────────────────────────────────────────────────────────
async function generateAnswer(
    query: string,
    mergedSaves: any[],
    entities: string[]
): Promise<string> {
    const contextText = mergedSaves.length > 0
        ? mergedSaves.map((s, i) =>
            `[${i + 1}] (${s.source || 'link'} / ${s.retrieval_source || 'vector'}) ${s.title}: ${s.summary}`
        ).join('\n')
        : 'No relevant saves found.'

    const entityContext = entities.length > 0
        ? `Key entities from your query: ${entities.join(', ')}.`
        : ''

    const prompt = `You are a "Second Brain" AI assistant with access to the user's saved links.

User Query: "${query}"
${entityContext}

Your goal: Answer the query using ONLY the provided context.
- Reference specific saves by [number] and title.
- Synthesize information across multiple saves.
- Be concise and actionable.
- Mention if a save was found via graph traversal (entity connections).
- If no relevant saves, say so honestly.

Saved content:
${contextText}

Answer:`

    try {
        const text = await callOpenAI(prompt, { temperature: 0.7, maxTokens: 1024, jsonMode: false })
        return text || 'No response generated.'
    } catch (e) {
        throw new Error(`OpenAI answer error: ${e.message}`)
    }
}

// ── Handler ──────────────────────────────────────────────────────────────────
serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const body = await req.json()
        const { query, user_phone } = body
        if (!query) throw new Error('query required')

        // ── Cache check: return immediately on exact match ──
        const identifier = user_phone || req.headers.get('x-forwarded-for') || 'anonymous'
        const cacheKey = _cacheKey(query, identifier)
        const cached = _getCache(cacheKey)
        if (cached) {
            console.log(`[chat-brain] Cache hit for key: ${cacheKey.slice(0, 40)}…`)
            return new Response(JSON.stringify({ ...(cached as object), cached: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }
        // Rate limit: 15 queries per phone per day
        const rl = await checkRateLimit(identifier, 'chat-brain')
        if (!rl.allowed) {
            return new Response(JSON.stringify({ error: `Daily AI search limit reached (${rl.limit}/day). Try again tomorrow!` }), {
                status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 1. Extract query entities + intent (in parallel with embedding)
        const [extractResult, queryEmbedding] = await Promise.all([
            extractQueryEntities(query),
            generateEmbedding(query),
        ])

        const { entities: queryEntities, intent, require_all, filters } = extractResult

        // 2. Vector search (existing, unchanged)
        const { data: vectorSaves, error: vecErr } = await supabase.rpc('match_saves', {
            query_embedding: queryEmbedding,
            match_threshold: 0.45,
            match_count: 8,
            filter: { is_deleted: false }
        })
        if (vecErr) console.error('[chat-brain] vector search error:', vecErr)

        const vectorResults = (vectorSaves || []).map((s: any) => ({
            ...s, retrieval_source: 'vector',
        }))

        // 3. Graph retrieval (if Neo4j configured + phone provided)
        const phone = user_phone || clientIP
        const { saves: graphSaves, entityKeys, matchedEntityNames, hopsRan } =
            await graphRetrieval(phone, queryEntities, require_all, 8)

        // 4. Merge + deduplicate
        const merged: any[] = []
        const seenIds = new Set<string>()

        for (const s of graphSaves) {
            if (!seenIds.has(s.id)) {
                seenIds.add(s.id)
                merged.push(s)
            }
        }
        for (const s of vectorResults) {
            if (!seenIds.has(s.id)) {
                seenIds.add(s.id)
                merged.push({ ...s, retrieval_source: 'vector' })
            } else {
                // Mark as found by both
                const existing = merged.find(m => m.id === s.id)
                if (existing) existing.retrieval_source = 'both'
            }
        }

        // Sort: both > graph > vector, then by score
        merged.sort((a, b) => {
            const order = { both: 0, graph: 1, vector: 2 }
            const oa = order[a.retrieval_source] ?? 2
            const ob = order[b.retrieval_source] ?? 2
            if (oa !== ob) return oa - ob
            return (b.similarity || b.graph_score || 0) - (a.similarity || a.graph_score || 0)
        })

        const finalSaves = merged.slice(0, 10)

        // 5. Generate answer
        const reply = await generateAnswer(query, finalSaves, matchedEntityNames)

        // 6. Build citations
        const citations = finalSaves.map(s => ({
            save_id: s.id,
            title: s.title || s.summary?.slice(0, 60) || 'Untitled',
            url: s.url || '',
            source: s.retrieval_source || 'vector',
            matched_entities: s.matched_entities || [],
            similarity: s.similarity ? Math.round(s.similarity * 100) / 100 : null,
        }))

        const responsePayload = {
            reply,
            citations,
            // Legacy field for backward compat
            references: vectorResults,
            // Full retrieval telemetry
            retrieval: {
                entities_extracted: queryEntities.map(e => e.name),
                graph_entities_matched: matchedEntityNames,
                graph_save_ids: graphSaves.map(s => s.id),
                vector_save_ids: vectorResults.map(s => s.id),
                merged_ids: finalSaves.map(s => s.id),
                hops: hopsRan ? 2 : 1,
                intent,
                require_all,
                neo4j_active: isNeo4jConfigured(),
            },
        }

        // Store in cache for future identical queries
        _setCache(cacheKey, responsePayload)

        return new Response(JSON.stringify(responsePayload), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error('[chat-brain] error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
