export interface Profile { id: string; name: string; email: string; learningEnabled?: boolean; memoryRevision?: number }
export interface Party { id: string; name: string; goal: string; ownerId: string; createdAt: string }
export interface Member { userId: string; name: string; joinedAt: string; role: 'owner' | 'member'; useSharedMemory?: boolean; memoryRevision?: number }
export type RunStatus = 'queued' | 'thinking' | 'completed' | 'failed' | 'cancelled';
export interface Message { id: string; partyId: string; authorId: string; authorName: string; role: 'user' | 'assistant'; text: string; createdAt: string; runId?: string }
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
export interface MemoryList { memories: MemoryFact[]; profilePreview: string; memoryRevision: number }
export interface CreateMemoryInput { text: string; category?: string; expiresAt?: string; approved?: boolean }
export interface UpdateMemoryInput { version: number; text?: string; category?: string; expiresAt?: string | null; approved?: boolean }
export interface PartyFact { id: string; text: string; speakerId: string; sourceMessageIds: string[]; createdAt: string }
