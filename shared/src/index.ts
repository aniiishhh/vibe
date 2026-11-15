export interface Profile { id: string; name: string; email: string }
export interface Party { id: string; name: string; goal: string; ownerId: string; createdAt: string }
export interface Member { userId: string; name: string; joinedAt: string; role: 'owner' | 'member' }
export type RunStatus = 'queued' | 'thinking' | 'completed' | 'failed' | 'cancelled';
export interface Message { id: string; partyId: string; authorId: string; authorName: string; role: 'user' | 'assistant'; text: string; createdAt: string; runId?: string }
export interface AgentRun { id: string; partyId: string; triggerMessageId: string; status: RunStatus; error?: string; replyMessageId?: string; createdAt: string }
export interface MessagePage { messages: Message[]; nextCursor?: string; runs: AgentRun[] }
export interface SendResult { message: Message; run?: AgentRun }
export interface Invite { token: string; expiresAt: string }
export interface ApiError { code: string; message: string; requestId: string; retryable: boolean }
