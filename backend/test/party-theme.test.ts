import { describe, expect, it, vi } from 'vitest';
import type { ConverseCommandOutput } from '@aws-sdk/client-bedrock-runtime';
import { PARTY_THEMES } from '@vibe/shared';
import { selectPartyTheme } from '../src/party-theme.js';
import { toParty } from '../src/store.js';
const answer = (text: string) => ({ stopReason: 'end_turn', output: { message: { role: 'assistant', content: [{ text }] } } }) as ConverseCommandOutput;

describe('semantic party themes', () => {
  it('uses bounded model input from both name and goal and accepts every existing theme', async () => {
    for (const theme of PARTY_THEMES) {
      const invoke = vi.fn(async () => answer(theme));
      expect(await selectPartyTheme('Launch party', 'Master eigenvectors before Tuesday', invoke)).toEqual({ theme, themeSource: 'model' });
      const [command, signal] = invoke.mock.calls[0]! as unknown as [any, AbortSignal];
      expect(command.input.inferenceConfig).toEqual({ maxTokens: 32, temperature: 0 });
      expect(JSON.parse(command.input.messages[0].content[0].text)).toEqual({ name: 'Launch party', goal: 'Master eigenvectors before Tuesday' });
      expect(signal).toBeInstanceOf(AbortSignal);
    }
  });
  it('uses a neutral fallback for invalid, truncated and unavailable model responses', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const text of ['unknown', 'study because it concerns learning', '']) {
        expect(await selectPartyTheme('Name', 'Goal', async () => answer(text))).toEqual({ theme: 'chill', themeSource: 'fallback' });
      }
      expect(await selectPartyTheme('Name', 'Goal', async () => ({ ...answer('study'), stopReason: 'max_tokens' }))).toMatchObject({ themeSource: 'fallback' });
      expect(await selectPartyTheme('Name', 'Goal', async () => { throw new Error('Provider unavailable'); })).toEqual({ theme: 'chill', themeSource: 'fallback' });
    } finally { warn.mockRestore(); }
  });
  it('round-trips stored themes and handles older parties without a saved theme', () => {
    const old = { id: 'p', name: 'Party', goal: 'Goal', ownerId: 'u', createdAt: '2026-11-15' };
    expect(toParty(old).theme).toBeUndefined();
    expect(toParty({ ...old, theme: 'study', themeSource: 'model' })).toMatchObject({ theme: 'study', themeSource: 'model' });
    expect(toParty({ ...old, theme: 'invalid' }).theme).toBeUndefined();
  });
});
