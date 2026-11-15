import { describe, expect, it } from 'vitest';
import type { Message } from '@vibe/shared';
import { boundedConversation, memoryQueryForTurn, isVibeMention, leaseIsActive, memberRemovalPermission } from '../src/domain.js';

describe('agent request boundaries', () => {
  it('recognizes an explicit @Vibe mention without matching email addresses', () => {
    expect(isVibeMention('@Vibe help us plan')).toBe(true);
    expect(isVibeMention('Can you help, @vIbE?')).toBe(true);
    expect(isVibeMention('email me at learner@vibe.example')).toBe(false);
  });

  it('keeps the newest chat context within 40 messages and 12,000 characters', () => {
    const messages: Message[] = Array.from({ length: 45 }, (_, index) => ({
      id: String(index).padStart(26, '0'),
      partyId: 'party',
      authorId: `user-${index}`,
      authorName: `Student ${index}`,
      role: 'user',
      text: `${index}: ${'x'.repeat(400)}`,
      createdAt: new Date(index).toISOString(),
    }));
    const context = boundedConversation(messages);
    expect(context.at(-1)?.content).toContain('Student 44');
    expect(context.length).toBeLessThanOrEqual(40);
    expect(context.reduce((total, message) => total + message.content.length, 0)).toBeLessThanOrEqual(12_000);
  });

  it('keeps the current narrow question first and excludes earlier assistant recaps from retrieval', () => {
    const request = 'How is Professor Sample for CSE 475?';
    const history = [
      {role:'user',authorName:'Alice',text:'Find classes for our whole group.'},
      {role:'assistant',authorName:'Vibe',text:'Unrelated database and circuits recap. '.repeat(100)},
      {role:'user',authorName:'Alice',text:request},
    ] as Message[];
    const query=memoryQueryForTurn(request,history);
    expect(query.startsWith(request)).toBe(true);
    expect(query).not.toContain('Unrelated database and circuits recap');
    expect(query.length).toBeLessThanOrEqual(1200);
  });

  it('does not let a duplicate worker treat an active lease as expired', () => {
    expect(leaseIsActive('thinking', 20_000, 19_999)).toBe(true);
    expect(leaseIsActive('thinking', 20_000, 20_001)).toBe(false);
    expect(leaseIsActive('queued', 20_000, 19_999)).toBe(false);
  });

  it('limits member removal to owners and self-service leave', () => {
    expect(memberRemovalPermission('owner', 'owner', 'member')).toBe('allowed');
    expect(memberRemovalPermission('owner', 'member', 'member')).toBe('allowed');
    expect(memberRemovalPermission('owner', 'member', 'other')).toBe('forbidden');
    expect(memberRemovalPermission('owner', 'owner', 'owner')).toBe('owner-cannot-leave');
  });
});
