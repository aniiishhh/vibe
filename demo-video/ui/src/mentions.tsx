import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { Member } from '@vibe/shared';

export interface MentionOption {
  id: string;
  name: string;
  kind: 'vibe' | 'member';
}

export const VIBE_OPTION: MentionOption = { id: 'vibe', name: 'Vibe', kind: 'vibe' };

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Names that count as mentions: Vibe, each member's full name and first name. */
export function mentionNames(members: Member[]) {
  const names = new Set<string>(['Vibe']);
  members.forEach((member) => {
    const full = member.name.trim();
    if (full) names.add(full);
    const first = full.split(/\s+/)[0];
    if (first && first.length > 1) names.add(first);
  });
  return [...names].sort((a, b) => b.length - a.length);
}

export function mentionPattern(names: string[]) {
  return new RegExp(`@(${names.map(escape).join('|')})(?![\\p{L}\\p{N}_])`, 'giu');
}

/** Splits plain text into strings and mention spans. */
export function highlightMentions(text: string, pattern: RegExp, keyPrefix = 'm'): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const isVibe = match[1].toLowerCase() === 'vibe';
    parts.push(<span key={`${keyPrefix}-${index}`} className={isVibe ? 'mention mention-vibe' : 'mention'}>{match[0]}</span>);
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Applies mention highlighting to string children of a rendered Markdown element. */
export function withMentions(children: ReactNode, pattern: RegExp): ReactNode {
  return Children.map(children, (child, index) => {
    if (typeof child === 'string') return highlightMentions(child, pattern, `c${index}`);
    if (isValidElement(child) && typeof child.type === 'string' && child.type !== 'code' && child.type !== 'a') {
      const element = child as ReactElement<{ children?: ReactNode }>;
      return cloneElement(element, undefined, withMentions(element.props.children, pattern));
    }
    return child;
  });
}

/** Finds an "@query" being typed right before the caret. */
export function activeMentionQuery(value: string, caret: number) {
  const before = value.slice(0, caret);
  const match = /(^|\s)@([\p{L}\p{N}_]*)$/u.exec(before);
  if (!match) return null;
  return { start: caret - match[2].length - 1, query: match[2] };
}
