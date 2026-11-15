import type { Message } from '@vibe/shared';

export function isVibeMention(text: string): boolean {
  return /(^|\s)@vibe\b/i.test(text);
}

export function memberRemovalPermission(
  ownerId: string,
  actorId: string,
  targetId: string,
): 'allowed' | 'owner-cannot-leave' | 'forbidden' {
  if (ownerId === actorId && targetId === ownerId) return 'owner-cannot-leave';
  if (actorId !== ownerId && targetId !== actorId) return 'forbidden';
  if (targetId === ownerId) return 'forbidden';
  return 'allowed';
}

export function leaseIsActive(status: unknown, leaseUntil: unknown, now: number): boolean {
  return status === 'thinking' && Number(leaseUntil ?? 0) >= now;
}

export interface ContextMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function boundedConversation(messages: Message[]): ContextMessage[] {
  const recent = messages.slice(-40);
  const selected: ContextMessage[] = [];
  let remaining = 12_000;
  for (let index = recent.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const message = recent[index]!;
    const prefix = message.role === 'user' ? `${message.authorName}: ` : '';
    const content = `${prefix}${message.text}`;
    if (content.length <= remaining) {
      selected.unshift({ role: message.role, content });
      remaining -= content.length;
    } else if (selected.length === 0) {
      selected.unshift({
        role: message.role,
        content: `${prefix}${content.slice(-Math.max(0, remaining - prefix.length))}`,
      });
      remaining = 0;
    } else {
      break;
    }
  }
  return selected;
}

/** Retrieval starts with this turn; older assistant recaps must not become the query. */
export function memoryQueryForTurn(request: string, history: Message[]): string {
  const context = history.filter(message => message.role === 'user' && message.text !== request).slice(-3);
  return [request.slice(0, 650), ...context.map(message => `${message.authorName}: ${message.text.slice(0, 160)}`)].join('\n').slice(0, 1200);
}
