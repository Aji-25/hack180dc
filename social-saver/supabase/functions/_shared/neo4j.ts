// @ts-nocheck
// Neo4j client using the official neo4j-driver via npm: import.
// neo4j-driver v5.14+ officially supports Deno using Bolt over WebSockets.
// Aura Free BLOCKS the HTTP transactional Cypher API — so we use Bolt instead.

import neo4j from 'npm:neo4j-driver@5'

const NEO4J_URI = Deno.env.get('NEO4J_URI') || ''
const NEO4J_USER = Deno.env.get('NEO4J_USER') || 'neo4j'
const NEO4J_PASSWORD = Deno.env.get('NEO4J_PASSWORD') || ''

export function isNeo4jConfigured(): boolean {
    return !!(NEO4J_URI && NEO4J_PASSWORD)
}

// Lazily create a single driver instance (reused across invocations in same isolate)
let _driver: any = null

function getDriver() {
    if (!_driver) {
        _driver = neo4j.driver(
            NEO4J_URI,
            neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
            {
                maxConnectionPoolSize: 5,
                connectionAcquisitionTimeout: 10000,
            }
        )
    }
    return _driver
}

/**
 * Run a single Cypher query and return rows as plain objects.
 * Automatically converts Neo4j Integer types to JS numbers.
 */
export async function runCypher(
    cypher: string,
    params: Record<string, any> = {}
): Promise<Record<string, any>[]> {
    if (!isNeo4jConfigured()) {
        console.warn('[neo4j] Not configured — skipping Cypher')
        return []
    }

    const driver = getDriver()
    // AuraDB Free doesn't support explicit database selection — open a session without specifying database
    const session = driver.session()
    try {
        // Auto-convert integer-like params to neo4j.int() to avoid "20.0 is not valid integer" errors
        // BUT skip values that are already neo4j integers (neo4j.isInt()) to prevent corruption
        function convertParam(val: any): any {
            if (val === null || val === undefined) return val
            if (neo4j.isInt(val)) return val  // already a neo4j integer, leave alone
            if (typeof val === 'number' && Number.isInteger(val)) return neo4j.int(val)
            if (Array.isArray(val)) return val.map(convertParam)
            if (typeof val === 'object') {
                const out: any = {}
                for (const k in val) out[k] = convertParam(val[k])
                return out
            }
            return val
        }
        const result = await session.run(cypher, convertParam(params))
        return result.records.map(record => {
            const obj: Record<string, any> = {}
            record.keys.forEach((key: string) => {
                const val = record.get(key)
                obj[key] = convertValue(val)
            })
            return obj
        })
    } finally {
        await session.close()
    }
}

/**
 * Run multiple Cypher statements in sequence (each in its own session).
 * Used for setup/schema operations.
 */
export async function runCypherBatch(
    statements: Array<{ cypher: string; params?: Record<string, any> }>
): Promise<void> {
    for (const s of statements) {
        await runCypher(s.cypher, s.params || {})
    }
}

/** Convert Neo4j driver types to plain JS values */
function convertValue(val: any): any {
    if (val === null || val === undefined) return val
    if (neo4j.isInt(val)) return val.toNumber()
    if (Array.isArray(val)) return val.map(convertValue)
    if (val && typeof val === 'object' && val.constructor?.name === 'Node') {
        return { ...val.properties }
    }
    if (val && typeof val === 'object' && val.constructor?.name === 'Relationship') {
        return { ...val.properties, _type: val.type }
    }
    if (typeof val === 'object' && !Array.isArray(val)) {
        const out: Record<string, any> = {}
        for (const k of Object.keys(val)) out[k] = convertValue(val[k])
        return out
    }
    return val
}

/**
 * Bootstrap Neo4j schema — constraints + indexes.
 * Safe to run multiple times (uses IF NOT EXISTS).
 */
export async function ensureSchema(): Promise<void> {
    if (!isNeo4jConfigured()) return
    const statements = [
        'CREATE CONSTRAINT user_phone_unique IF NOT EXISTS FOR (u:User) REQUIRE u.phone IS UNIQUE',
        'CREATE CONSTRAINT save_id_unique    IF NOT EXISTS FOR (s:Save) REQUIRE s.id IS UNIQUE',
        'CREATE CONSTRAINT entity_key_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.key IS UNIQUE',
        'CREATE INDEX entity_name_idx   IF NOT EXISTS FOR (e:Entity) ON (e.name)',
        'CREATE INDEX entity_phone_idx  IF NOT EXISTS FOR (e:Entity) ON (e.user_phone)',
    ]
    for (const cypher of statements) {
        try { await runCypher(cypher) } catch (e) {
            console.warn('[neo4j] schema stmt skipped:', e.message)
        }
    }
}

/** Tiny Levenshtein for client-side fuzzy entity matching */
export function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => i || j)
    )
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    return dp[m][n]
}

/** Normalize entity name for key generation */
export function normalizeEntityName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^\w\s-]/g, '')
}

/** Build scoped entity key */
export function entityKey(phone: string, name: string): string {
    return `${phone}::${normalizeEntityName(name)}`
}

/** Compute all pairs (a < b alphabetically) for CO_OCCURS_WITH */
export function buildPairs(keys: string[]): Array<{ a: string; b: string }> {
    const pairs: Array<{ a: string; b: string }> = []
    for (let i = 0; i < keys.length; i++)
        for (let j = i + 1; j < keys.length; j++) {
            const [a, b] = [keys[i], keys[j]].sort()
            pairs.push({ a, b })
        }
    return pairs
}

/**
 * Two-stage entity matching:
 * Stage 1: exact key or exact normalized name
 * Stage 2: prefix fetch → Levenshtein in TS (distance ≤ 3)
 */
export async function matchEntityKeys(phone: string, name: string): Promise<string[]> {
    const norm = normalizeEntityName(name)
    const key = entityKey(phone, name)

    const exact = await runCypher(
        `MATCH (e:Entity {user_phone: $phone})
         WHERE e.key = $key OR toLower(e.name) = $norm
         RETURN e.key AS key LIMIT 5`,
        { phone, key, norm }
    )
    if (exact.length > 0) return exact.map(r => r.key)

    const prefix = norm.slice(0, Math.min(4, norm.length))
    if (!prefix) return []

    const candidates = await runCypher(
        `MATCH (e:Entity {user_phone: $phone})
         WHERE toLower(e.name) STARTS WITH $prefix
         RETURN e.key AS key, e.name AS name LIMIT 50`,
        { phone, prefix }
    )

    return candidates
        .map(c => ({ key: c.key, dist: levenshtein(normalizeEntityName(c.name), norm) }))
        .filter(c => c.dist <= 3)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3)
        .map(c => c.key)
}
