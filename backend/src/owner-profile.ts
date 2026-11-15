import { getSupermemoryClient, privateNamespace } from './memory-provider.js';
import { getOwnerRevision, listOwnerFacts } from './memory-store.js';
import { AppError } from './store.js';
/** Owner-only preview. Derived provider text is never trusted merely because it is in a profile. */
export async function ownerProfile(ownerId: string) {
    const revision = await getOwnerRevision(ownerId);
    const facts = (await listOwnerFacts(ownerId)).filter(f => !f.expiresAt || Date.parse(f.expiresAt) > Date.now());
    const chosen = facts.slice(0, 12);
    const buckets = [...new Set(chosen.map(f => f.category))].map(category => ({
        category, points: chosen.filter(f => f.category === category).map(f => ({ id: f.id, text: f.text, approval: f.approval })),
    }));
    let providerStatus: 'ready' | 'processing' | 'unavailable' | 'unverified' = 'processing';
    let matchedPoints = 0;
    if (facts.length && facts.length <= 40 && facts.every(f => f.syncState === 'synced')) {
        try {
            const client = await getSupermemoryClient();
            const response = await client.profile(privateNamespace(ownerId), {
                buckets: ['academics', 'travel', 'communication'],
                filter: { operator: 'or', operands: facts.map(f => ({ operator: 'and', operands: [
                            { field: 'factId', operator: 'eq', value: f.id }, { field: 'version', operator: 'eq', value: f.version },
                        ] })) },
            }, { timeoutInSeconds: 4, maxRetries: 0 });
            const current = new Set(facts.map(f => f.text.trim()));
            const entries = [...response.profile.static, ...response.profile.dynamic, ...Object.values(response.profile.buckets).flat()];
            matchedPoints = new Set(entries.filter(e => current.has(e.memory.trim())).map(e => e.memory.trim())).size;
            providerStatus = !entries.length ? 'processing' : entries.every(e => current.has(e.memory.trim())) ? 'ready' : 'unverified';
        }
        catch {
            providerStatus = 'unavailable';
        }
    }
    if (await getOwnerRevision(ownerId) !== revision)
        throw new AppError(409, 'MEMORY_CONFLICT', 'Your memory changed while building the preview. Refresh it.');
    return { revision, buckets, providerStatus, matchedPoints, checkedAt: new Date().toISOString(), truncated: facts.length > 12 };
}
