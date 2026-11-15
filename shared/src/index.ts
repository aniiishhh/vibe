export const PARTY_THEMES = ['travel', 'study', 'build', 'food', 'outdoors', 'celebrate', 'chill'] as const;
export type PartyTheme = typeof PARTY_THEMES[number];
export const DEFAULT_MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
export interface Profile { id: string; name: string; email: string; learningEnabled?: boolean; memoryRevision?: number }
export interface Party { id: string; name: string; goal: string; ownerId: string; createdAt: string; mode?: ConversationMode; settingsVersion?: number; archived?: boolean; theme?: PartyTheme; themeSource?: 'model' | 'fallback' }
export interface Member { userId: string; name: string; joinedAt: string; role: 'owner' | 'admin' | 'member'; useSharedMemory?: boolean; memoryRevision?: number }
export type RunStatus = 'queued' | 'thinking' | 'completed' | 'failed' | 'cancelled';
export interface Message { id: string; partyId: string; authorId: string; authorName: string; role: 'user' | 'assistant'; text: string; createdAt: string; replyToId?: string; runId?: string; citations?: Array<{id:string;url:string;retrievedAt:string}>; researchWarnings?: string[] }
export interface AgentRun { id: string; partyId: string; triggerMessageId: string; status: RunStatus; error?: string; replyMessageId?: string; createdAt: string }
export interface MessagePage { messages: Message[]; nextCursor?: string; runs: AgentRun[] }
export interface SendResult { message: Message; run?: AgentRun }
export interface Invite { token: string; expiresAt: string }
export interface ApiError { code: string; message: string; requestId: string; retryable: boolean }

export type MemoryApproval = 'private' | 'candidate' | 'approved';
export type MemorySyncState = 'pending' | 'processing' | 'synced' | 'error' | 'deleting';
export interface MemoryFact {
  id: string;
  ownerId: string;
  text: string;
  category: string;
  version: number;
  approval: MemoryApproval;
  approvedVersion?: number;
  source: 'manual' | 'conversation';
  sourcePartyId?: string;
  sourceMessageIds?: string[];
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  syncState: MemorySyncState;
  syncError?: string;
  deleted?: boolean;
}
export interface MemoryList { memories: MemoryFact[]; profilePreview: string; memoryRevision: number; extractionState?: 'pending' | 'processing' | 'idle' | 'error'; extractionUpdatedAt?: string }
export interface CreateMemoryInput { text: string; category?: string; expiresAt?: string; approved?: boolean }
export interface UpdateMemoryInput { version: number; text?: string; category?: string; expiresAt?: string | null; approved?: boolean }
export type ConversationMode = 'focused' | 'friendly' | 'banter';
export interface TaskInput { title: string; description?: string; assigneeId?: string | null; dueAt?: string | null }
export interface PartyTask { id: string; partyId: string; title: string; description: string; assigneeId?: string; dueAt?: string; status: 'proposed' | 'accepted' | 'declined' | 'completed'; version: number; acceptedVersion?: number; proposedBy: string; createdAt: string; updatedAt: string }
export type ParticipationStatus = 'suggested' | 'confirmed' | 'unresolved' | 'withdrawn';
export type PartyNoteKind = 'decision' | 'suggestion' | 'constraint' | 'question' | 'disagreement' | 'preference' | 'participation';
export interface PartyFact { participationStatus?: ParticipationStatus; proposalMessageIds?: string[]; responseMessageId?: string; lastEditorId?: string; subjectId?: string; subjectName?: string; topic?: string; version?: number; kind?: PartyNoteKind; updatedAt?: string; updatedBy?: string; expiresAt?: string; source?: 'manual' | 'conversation'; speakerIds?: string[]; id: string; text: string; speakerId: string; sourceMessageIds: string[]; createdAt: string }
