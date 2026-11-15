import { beforeEach, describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getOwnerRevision: vi.fn(), listOwnerFacts: vi.fn(), getSupermemoryClient: vi.fn() }));
vi.mock('../src/memory-store.js', () => ({ getOwnerRevision: mocks.getOwnerRevision, listOwnerFacts: mocks.listOwnerFacts }));
vi.mock('../src/memory-provider.js', () => ({ getSupermemoryClient: mocks.getSupermemoryClient, privateNamespace: (id: string) => `private-${id}` }));
import { ownerProfile } from '../src/owner-profile.js';
beforeEach(() => { vi.resetAllMocks(); mocks.getOwnerRevision.mockResolvedValue(2); mocks.listOwnerFacts.mockResolvedValue([{ id: 'current', text: 'Current preference', category: 'academics', version: 2, syncState: 'synced', approval: 'private' }]); });
describe('owner-only profile preview', () => {
    it('uses current canonical points when provider summaries lag', async () => {
        const profile = vi.fn(async (_namespace: string) => ({ profile: { static: [{ id: 'old', memory: 'Superseded preference' }], dynamic: [], buckets: {} } }));
        mocks.getSupermemoryClient.mockResolvedValue({ profile });
        const result = await ownerProfile('owner');
        expect(result.providerStatus).toBe('unverified');
        expect(result.matchedPoints).toBe(0);
        expect(result.buckets[0].points[0].text).toBe('Current preference');
        expect(profile.mock.calls[0][0]).toBe('private-owner');
    });
    it('rejects a preview built across a correction', async () => {
        mocks.getOwnerRevision.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
        mocks.getSupermemoryClient.mockRejectedValue(Error('offline'));
        await expect(ownerProfile('owner')).rejects.toMatchObject({ statusCode: 409 });
    });
});
