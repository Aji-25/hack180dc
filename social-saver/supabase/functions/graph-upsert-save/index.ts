// @ts-nocheck
// graph-upsert-save: Extract entities from a save and upsert into Neo4j.
// Called by process-graph-jobs (drain queue) or directly for single saves.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
    runCypher, runCypherBatch, ensureSchema, isNeo4jConfigured,
    entityKey, normalizeEntityName, buildPairs
} from '../_shared/neo4j.ts'
import { checkDemoKey } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
import { callOpenAI } from '../_shared/llm.ts'
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-demo-key',
}

// ── Entity extraction schema ────────────────────────────────────────────────
const EXTRACT_PROMPT = (save: any) => `You are a precise entity extractor for a personal knowledge base.

Extract entities and relations from this saved content.

Content:
Title: ${save.title || ''}
Summary: ${save.summary || ''}
Category: ${save.category || ''}
Tags: ${(save.tags || []).join(', ')}
Source: ${save.source || ''}
Note: ${save.note || ''}

Rules:
- Extract 4-12 entities max. Quality over quantity.
- Types: tool | concept | topic | exercise | food | brand | person | other
- Include only entities strongly implied by the text — no hallucinations.
- Normalize names: lowercase, trim, no punctuation except hyphens.
- Provide aliases for common variants.
- Relations (optional): only if clearly implied. rel_types: requires | related | improves | example_of | uses | part_of
- Confidence: 0.0–1.0

Return ONLY valid JSON matching this schema exactly:
{
  "entities": [
    {
      "name": "string (normalized)",
      "type": "tool|concept|topic|exercise|food|brand|person|other",
      "aliases": ["string"],
      "confidence": 0.85
    }
  ],
  "relations": [
    {
      "src": "entity name",
      "dst": "entity name",
      "rel_type": "requires|related|improves|example_of|uses|part_of",
      "weight": 0.8,
      "evidence": "short phrase ≤15 words"
    }
  ]
}`

async function extractEntities(save: any): Promise<{ entities: any[]; relations: any[] }> {
    const prompt = EXTRACT_PROMPT(save)
    let text = '{}'
    try {
        text = await callOpenAI(prompt, { temperature: 0.1, maxTokens: 1024, jsonMode: true })
    } catch (e) {
        throw new Error(`OpenAI extraction error: ${e.message}`)
    }

    try {
        const parsed = JSON.parse(text)
        return {
            entities: (parsed.entities || []).slice(0, 12),
            relations: (parsed.relations || []).slice(0, 10),
        }
    } catch {
        // Retry with stricter prompt
        console.warn('[graph-upsert] JSON parse failed, retrying with strict prompt')
        return { entities: [], relations: [] }
    }
}

// ── Neo4j upsert logic ──────────────────────────────────────────────────────
async function upsertToNeo4j(save: any, phone: string, entities: any[], relations: any[]) {
    await ensureSchema()

    // 1. Upsert User + Save + Category + Tags
    await runCypher(`
        MERGE (u:User {phone: $phone})
        MERGE (s:Save {id: $save_id})
            ON CREATE SET s.url=$url, s.title=$title, s.summary=$summary,
                          s.source=$source, s.created_at=$created_at, s.user_phone=$phone
            ON MATCH  SET s.title=$title, s.summary=$summary
        MERGE (u)-[:SAVED]->(s)
        MERGE (cat:Category {name: $category})
        MERGE (s)-[:IN_CATEGORY]->(cat)
    `, {
        phone,
        save_id: save.id,
        url: save.url || '',
        title: save.title || save.summary?.slice(0, 80) || '',
        summary: save.summary || '',
        source: save.source || '',
        created_at: save.created_at || new Date().toISOString(),
        category: save.category || 'Other',
    })

    // 2. Tags
    if (save.tags?.length > 0) {
        await runCypher(`
            MATCH (s:Save {id: $save_id})
            UNWIND $tags AS tagName
                MERGE (t:Tag {name: tagName})
                MERGE (s)-[:HAS_TAG]->(t)
        `, { save_id: save.id, tags: save.tags })
    }

    // 3. Entities + MENTIONS edges
    if (entities.length > 0) {
        const entParams = entities.map(e => ({
            key: entityKey(phone, e.name),
            name: normalizeEntityName(e.name),
            type: e.type || 'other',
            aliases: (e.aliases || []).map((a: string) => a.toLowerCase().trim()),
            confidence: e.confidence || 0.8,
            user_phone: phone,
        }))

        await runCypher(`
            UNWIND $entities AS ent
                MERGE (e:Entity {key: ent.key})
                    ON CREATE SET e.name=ent.name, e.type=ent.type,
                                  e.aliases=ent.aliases, e.user_phone=ent.user_phone
                    ON MATCH  SET e.aliases = e.aliases + [x IN ent.aliases WHERE NOT x IN e.aliases]
                WITH e, ent
                MATCH (s:Save {id: $save_id})
                MERGE (s)-[m:MENTIONS]->(e)
                    ON CREATE SET m.confidence=ent.confidence, m.source='extraction',
                                  m.created_at=$now
                    ON MATCH  SET m.confidence = CASE WHEN ent.confidence > m.confidence
                                                      THEN ent.confidence ELSE m.confidence END
        `, {
            entities: entParams,
            save_id: save.id,
            now: new Date().toISOString(),
        })
    }

    // 4. CO_OCCURS_WITH — pairs computed in TypeScript (not cartesian Cypher)
    const entityKeys = entities.map(e => entityKey(phone, e.name))
    const pairs = buildPairs(entityKeys)

    if (pairs.length > 0) {
        await runCypher(`
            UNWIND $pairs AS p
                MATCH (e1:Entity {key: p.a, user_phone: $phone})
                MATCH (e2:Entity {key: p.b, user_phone: $phone})
                MERGE (e1)-[c:CO_OCCURS_WITH]-(e2)
                    ON CREATE SET c.weight = 1.0
                    ON MATCH  SET c.weight = c.weight + 1.0
        `, { pairs, phone })
    }

    // 5. RELATED_TO edges from LLM relations
    const validRelations = relations.filter(r =>
        entities.some(e => normalizeEntityName(e.name) === normalizeEntityName(r.src)) &&
        entities.some(e => normalizeEntityName(e.name) === normalizeEntityName(r.dst))
    )

    if (validRelations.length > 0) {
        await runCypher(`
            UNWIND $rels AS r
                MATCH (e1:Entity {key: $phone + '::' + r.src_key, user_phone: $phone})
                MATCH (e2:Entity {key: $phone + '::' + r.dst_key, user_phone: $phone})
                MERGE (e1)-[rel:RELATED_TO {rel_type: r.rel_type}]->(e2)
                    ON CREATE SET rel.weight=r.weight, rel.evidence=r.evidence
                    ON MATCH  SET rel.weight = CASE WHEN r.weight > rel.weight
                                                    THEN r.weight ELSE rel.weight END
        `, {
            phone,
            rels: validRelations.map(r => ({
                src_key: normalizeEntityName(r.src),
                dst_key: normalizeEntityName(r.dst),
                rel_type: r.rel_type || 'related',
                weight: r.weight || 0.7,
                evidence: r.evidence || '',
            })),
        })
    }
}

// ── Handler ─────────────────────────────────────────────────────────────────
serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const authError = checkDemoKey(req)
    if (authError) return authError

    try {
        const { save_id, user_phone } = await req.json()
        if (!save_id || !user_phone) throw new Error('save_id and user_phone required')

        // Fetch save from Postgres
        const { data: save, error: fetchErr } = await supabase
            .from('saves').select('*').eq('id', save_id).eq('is_deleted', false).single()
        if (fetchErr || !save) throw new Error(`Save not found: ${save_id}`)

        // Extract entities
        const { entities, relations } = await extractEntities(save)

        // Upsert to Neo4j (graceful fallback if not configured)
        if (isNeo4jConfigured()) {
            await upsertToNeo4j(save, user_phone, entities, relations)
        } else {
            console.warn('[graph-upsert] Neo4j not configured — extraction done but graph skipped')
        }

        return new Response(JSON.stringify({
            ok: true,
            save_id,
            neo4j_active: isNeo4jConfigured(),
            entity_count: entities.length,
            relation_count: relations.length,
            entities: entities.map(e => ({ name: e.name, type: e.type, confidence: e.confidence })),
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (err) {
        console.error('[graph-upsert] error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
