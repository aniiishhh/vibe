import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryFact } from '@vibe/shared';
const mocks = vi.hoisted(() => ({ getItem: vi.fn(), readPartyMembers: vi.fn(), listOwnerFacts: vi.fn(), search: vi.fn() }));
vi.mock('../src/store.js', async () => ({ ...await vi.importActual('../src/store.js'), getItem: mocks.getItem }));
vi.mock('../src/memory-store.js', async () => ({ ...await vi.importActual('../src/memory-store.js'), readPartyMembers: mocks.readPartyMembers,
  listOwnerFacts: mocks.listOwnerFacts, listPartyFacts: async () => [], getOwnerRevision: async () => 2 }));
vi.mock('../src/memory-provider.js', async () => ({ ...await vi.importActual('../src/memory-provider.js'), getSupermemoryClient: async () => ({ search: mocks.search }) }));
import { buildMemoryContext } from '../src/memory-context.js';
const fact = (id: string, category: string, text: string, overrides: Partial<MemoryFact> = {}): MemoryFact => ({ id, category, text, ownerId: 'alice',
  version: 2, approval: 'approved', approvedVersion: 2, source: 'manual', syncState: 'synced', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z', ...overrides });
const context = (text: string) => buildMemoryContext({ partyId: 'party', triggerMessage: { id: 'z', createdAt: new Date().toISOString(), text } });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getItem.mockImplementation(async (_pk: string, sk: string) => sk === 'META' ? { membershipRevision: 0 } : undefined);
  mocks.readPartyMembers.mockResolvedValue([{ userId: 'alice', name: 'Alice', joinedAt: '2026-01-01', useSharedMemory: true }]);
  mocks.search.mockResolvedValue({ results: [] });
});
describe('canonical memory selection for group research', () => {
  it.each([
    ['Which classes should we research?', 'academics', 'Alice enjoys robotics classes.'],
    ['Plan a trip with us', 'travel', 'Alice prefers train travel for a trip.'],
    ['Brainstorm a hackathon project', 'general', 'Alice likes hardware hackathon projects.'],
  ])('retrieves an older relevant point for %s while excluding private and expired facts', async (query, category, text) => {
    mocks.listOwnerFacts.mockResolvedValue([fact('old', category, text), fact('private', category, 'Private secret', { approval: 'private' }),
      fact('expired', 'schedule', 'Expired constraint', { expiresAt: '2020-01-01T00:00:00Z' })]);
    const result = await context(query);
    expect(result.text).toContain(text);
    expect(result.text).not.toContain('Private secret');
    expect(result.text).not.toContain('Expired constraint');
  });
  it('retains conflicting active constraints for clarification rather than choosing silently', async () => {
    mocks.listOwnerFacts.mockResolvedValue([fact('a', 'schedule', 'Classes must end before noon.'), fact('b', 'schedule', 'Classes must start after 3 PM.')]);
    const result = await context('Find classes');
    expect(result.text).toContain('before noon');
    expect(result.text).toContain('after 3 PM');
  });
  it('rejects an oversized hard-constraint set before selection can silently drop one', async () => {
    mocks.listOwnerFacts.mockResolvedValue(Array.from({ length: 6 }, (_, i) => fact(String(i), 'schedule', `Required constraint ${i}`)));
    await expect(context('Find classes')).rejects.toThrow('Reduce shared-memory scope');
  });
});
