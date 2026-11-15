import type { Handler } from 'aws-lambda';
import { getItem } from './store.js';

interface SubscribeEvent {
  identity?: { sub?: unknown };
  info?: { channel?: { path?: unknown } };
}

export const handler: Handler<SubscribeEvent, null | { error: string }> = async (event) => {
  const userId = typeof event.identity?.sub === 'string' ? event.identity.sub : '';
  const channel = typeof event.info?.channel?.path === 'string' ? event.info.channel.path : '';
  const match = /^\/party\/([A-Za-z0-9_-]{1,128})$/.exec(channel);
  if (!userId || !match) return { error: 'Unauthorized' };
  const membership = await getItem(`PARTY#${match[1]}`, `MEMBER#${userId}`);
  return membership ? null : { error: 'Unauthorized' };
};
