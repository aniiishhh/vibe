import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CreateMemoryInput, MemoryFact, UpdateMemoryInput } from '@vibe/shared';
import { ApiRequestError, errorMessage, type VibeApi } from './api';
import './memory.css';

const MAX_PREVIEW_LENGTH = 1_500;

export function MemoryPage({ api }: { api: VibeApi }) {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: api.getProfile });
  const memoriesQuery = useQuery({
    queryKey: ['memories'],
    queryFn: api.getMemories,
    refetchInterval: (query) => query.state.data?.memories.some((memory) =>
      memory.syncState === 'pending' || memory.syncState === 'processing' || memory.syncState === 'deleting',
    ) ? 5_000 : false,
  });
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [createError, setCreateError] = useState('');
  const [learningError, setLearningError] = useState('');
  const [exportError, setExportError] = useState('');
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [approved, setApproved] = useState(false);
  const createMutation = useMutation({
    mutationFn: (input: CreateMemoryInput) => api.createMemory(input),
    onSuccess: async () => {
      setText('');
      setCategory('');
      setExpiresAt('');
      setApproved(false);
      setAdding(false);
      setCreateError('');
      await queryClient.invalidateQueries({ queryKey: ['memories'] });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => setCreateError(errorMessage(error, 'This memory point could not be saved.')),
  });
  const learningMutation = useMutation({
    mutationFn: (learningEnabled: boolean) => api.updateProfile({ learningEnabled }),
    onSuccess: async (profile) => {
      setLearningError('');
      queryClient.setQueryData(['profile'], profile);
      await queryClient.invalidateQueries({ queryKey: ['memories'] });
    },
    onError: (error) => {
      setLearningError(error instanceof ApiRequestError && error.status === 409
        ? 'Your learning setting changed elsewhere. The current setting is being refreshed.'
        : errorMessage(error, 'The learning setting could not be changed.'));
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
  const exportMutation = useMutation({
    mutationFn: api.exportMemories,
    onSuccess: (markdown) => {
      const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'vibe-memory.md';
      link.click();
      URL.revokeObjectURL(url);
      setExportError('');
    },
    onError: (error) => setExportError(errorMessage(error, 'The Markdown export could not be downloaded.')),
  });

  const memories = memoriesQuery.data?.memories ?? [];
  const filteredMemories = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return memories;
    return memories.filter((memory) => `${memory.text} ${memory.category} ${memory.source} ${memory.approval}`.toLowerCase().includes(needle));
  }, [memories, search]);
  const previewText = memoriesQuery.data?.profilePreview ?? '';
  const hasMorePreview = previewText.length > MAX_PREVIEW_LENGTH;
  const preview = previewText.slice(0, hasMorePreview ? MAX_PREVIEW_LENGTH - 1 : MAX_PREVIEW_LENGTH);
  const learningEnabled = profileQuery.data?.learningEnabled ?? false;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cleanText = text.trim();
    if (!cleanText || cleanText.length > 500) return;
    setCreateError('');
    createMutation.mutate({
      text: cleanText,
      ...(category.trim() ? { category: category.trim() } : {}),
      ...(expiresAt ? { expiresAt: toExpiryIso(expiresAt) } : {}),
      approved,
    });
  };

  return (
    <main className="memory-page">
      <header className="memory-page-header">
        <div>
          <h1>Personal memory</h1>
          <p>Review what Vibe remembers about you and choose what can travel between parties.</p>
        </div>
        <button
          className="button button-secondary memory-export"
          type="button"
          aria-label={exportMutation.isPending ? 'Preparing Markdown export' : 'Download Markdown'}
          title={exportMutation.isPending ? 'Preparing Markdown export' : 'Download Markdown'}
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
        >
          <Download size={16} aria-hidden="true" />
          <span className="memory-export-label">{exportMutation.isPending ? 'Preparing…' : 'Download Markdown'}</span>
        </button>
      </header>

      {exportError && <p className="inline-error memory-page-error" role="alert">{exportError}</p>}

      <section className="learning-setting" aria-labelledby="learning-title">
        <div className="learning-setting-copy">
          <div className="learning-icon"><Sparkles size={18} /></div>
          <div>
            <h2 id="learning-title">Learn from my messages</h2>
            <p>When this is on, Vibe can turn your own messages into private review candidates. Nothing is shared until you approve it and opt in for a party.</p>
            {learningError && <p className="inline-error learning-error" role="alert">{learningError}</p>}
          </div>
        </div>
        <button
          className={`switch-control${learningEnabled ? ' switch-on' : ''}`}
          type="button"
          role="switch"
          aria-checked={learningEnabled}
          aria-label="Learn from my messages"
          disabled={profileQuery.isPending || profileQuery.isError || learningMutation.isPending}
          onClick={() => { setLearningError(''); learningMutation.mutate(!learningEnabled); }}
        >
          <span className="switch-track"><span className="switch-thumb" /></span>
          <span className="switch-label">{learningMutation.isPending ? 'Saving…' : learningEnabled ? 'On' : 'Off'}</span>
        </button>
      </section>

      <section className="profile-preview-section" aria-labelledby="preview-title">
        <div className="section-title-row">
          <div><h2 id="preview-title">Profile preview</h2><p>A compact view of approved details that may be relevant in a party where you opt in.</p></div>
          {profileQuery.isError && <button className="text-button" type="button" onClick={() => void profileQuery.refetch()}>Retry profile</button>}
        </div>
        {memoriesQuery.isPending ? <div className="preview-skeleton"><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line short" /></div> : memoriesQuery.isError ? <p className="preview-unavailable">Your profile preview is unavailable until memories load.</p> : preview ? (
          <div className="profile-preview-text" aria-label={`Profile preview, up to ${MAX_PREVIEW_LENGTH} characters`}>{preview}{hasMorePreview ? '…' : ''}</div>
        ) : <div className="profile-preview-empty">No reusable profile summary yet. Approved memory points will appear here when available.</div>}
        {profileQuery.isError && <p className="preview-unavailable">Your learning setting could not load. Retry to change it.</p>}
      </section>

      <section className="memory-facts-section" aria-labelledby="facts-title">
        <div className="section-title-row memory-facts-heading">
          <div><h2 id="facts-title">Your memory points</h2><p>Manual notes and candidates from your own messages stay private until you approve reuse.</p></div>
          {!adding && <button className="button button-primary" type="button" onClick={() => { setAdding(true); setCreateError(''); }}><Plus size={16} /> Add a point</button>}
        </div>

        {adding && <form className="memory-create-form" onSubmit={submit}>
          <div className="memory-create-heading"><strong>Add a memory point</strong><button type="button" className="icon-button" aria-label="Close add form" onClick={() => { setAdding(false); setCreateError(''); }}><X size={17} /></button></div>
          <label className="field-label">What should Vibe remember?<textarea className="text-input text-area" rows={3} maxLength={500} required value={text} onChange={(event) => setText(event.target.value)} placeholder="For example, I prefer morning classes." /></label>
          <div className="memory-form-row">
            <label className="field-label">Category <span className="optional-label">Optional</span><input className="text-input" maxLength={60} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="e.g. Preferences" /></label>
            <label className="field-label">Expires <span className="optional-label">Optional</span><input className="text-input" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
          </div>
          <label className="memory-approval-option"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} /><span><strong>Approve for reuse across parties</strong><span>You still control which parties can use shared preferences.</span></span></label>
          {createError && <p className="inline-error" role="alert">{createError}</p>}
          <div className="memory-form-footer"><span>{text.length}/500</span><div><button className="button button-secondary" type="button" disabled={createMutation.isPending} onClick={() => { setAdding(false); setCreateError(''); }}>Cancel</button><button className="button button-primary" type="submit" disabled={!text.trim() || createMutation.isPending}>{createMutation.isPending ? 'Saving…' : 'Save point'}</button></div></div>
        </form>}

        <div className="memory-list-toolbar">
          <label className="memory-search"><Search size={15} /><input type="search" aria-label="Search memory points" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your memory" /></label>
          <span className="memory-count-label">{memoriesQuery.isPending ? 'Loading…' : `${filteredMemories.length} ${filteredMemories.length === 1 ? 'point' : 'points'}`}</span>
        </div>

        {memoriesQuery.isPending ? <div className="memory-list-skeleton"><span className="skeleton skeleton-heading" /><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line short" /></div> : memoriesQuery.isError ? (
          <div className="memory-list-error" role="alert"><p>{errorMessage(memoriesQuery.error, 'Your memory points could not be loaded.')}</p><button className="button button-secondary" type="button" onClick={() => void memoriesQuery.refetch()}>Try again</button></div>
        ) : filteredMemories.length > 0 ? (
          <div className="memory-list">
            {filteredMemories.map((memory) => <MemoryFactRow key={memory.id} api={api} fact={memory} ownerId={profileQuery.data?.id} />)}
          </div>
        ) : memories.length === 0 ? (
          <div className="memory-empty"><ShieldCheck size={21} /><h3>Your memory is yours to shape.</h3><p>Add a point yourself or turn on learning to review private candidates from your own messages.</p>{!adding && <button className="text-button" type="button" onClick={() => setAdding(true)}><Plus size={14} /> Add your first point</button>}</div>
        ) : <p className="memory-no-results">No memory points match “{search}”.</p>}
      </section>
    </main>
  );
}

function MemoryFactRow({ api, fact, ownerId }: { api: VibeApi; fact: MemoryFact; ownerId?: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [actionError, setActionError] = useState('');
  const [draftText, setDraftText] = useState(fact.text);
  const [draftCategory, setDraftCategory] = useState(fact.category ?? '');
  const [draftExpiry, setDraftExpiry] = useState(toDateInput(fact.expiresAt));
  const [editVersion, setEditVersion] = useState(fact.version);

  const afterChange = async () => {
    await queryClient.invalidateQueries({ queryKey: ['memories'] });
    await queryClient.invalidateQueries({ queryKey: ['profile'] });
  };
  const onConflict = (error: unknown) => {
    if (error instanceof ApiRequestError && error.status === 409) {
      setConflict(true);
      setActionError('This point changed in another session. Reload its current version before continuing.');
      void queryClient.invalidateQueries({ queryKey: ['memories'] });
    } else {
      setActionError(errorMessage(error, 'This change could not be saved.'));
    }
  };

  const updateMutation = useMutation({
    mutationFn: (input: UpdateMemoryInput) => api.updateMemory(fact.id, input),
    onSuccess: async () => { setEditing(false); setActionError(''); setConflict(false); await afterChange(); },
    onError: onConflict,
  });
  const approvalMutation = useMutation({
    mutationFn: (nextApproved: boolean) => api.updateMemory(fact.id, { version: fact.version, approved: nextApproved }),
    onSuccess: afterChange,
    onError: onConflict,
  });
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteMemory(fact.id, fact.version),
    onSuccess: async () => { setConfirmingDelete(false); setActionError(''); await afterChange(); },
    onError: onConflict,
  });

  const pending = updateMutation.isPending || approvalMutation.isPending || deleteMutation.isPending;
  const isOwner = Boolean(ownerId && fact.ownerId === ownerId);
  const isDeleted = fact.deleted === true;

  const startEdit = () => {
    setDraftText(fact.text);
    setDraftCategory(fact.category ?? '');
    setDraftExpiry(toDateInput(fact.expiresAt));
    setEditVersion(fact.version);
    setActionError('');
    setConflict(false);
    setEditing(true);
  };

  const saveEdit = (event: FormEvent) => {
    event.preventDefault();
    const cleanText = draftText.trim();
    if (!cleanText || cleanText.length > 500) return;
    setActionError('');
    updateMutation.mutate({
      version: editVersion,
      text: cleanText,
      category: draftCategory.trim(),
      expiresAt: draftExpiry ? toExpiryIso(draftExpiry) : null,
    });
  };

  const reloadCurrent = async () => {
    setActionError('');
    try {
      const result = await queryClient.fetchQuery({ queryKey: ['memories'], queryFn: api.getMemories, staleTime: 0 });
      const latest = result.memories.find((item) => item.id === fact.id);
      if (latest) {
        setDraftText(latest.text);
        setDraftCategory(latest.category ?? '');
        setDraftExpiry(toDateInput(latest.expiresAt));
        setEditVersion(latest.version);
        setConfirmingDelete(false);
        setEditing(false);
        setConflict(false);
        setActionError('Current memory loaded. Reopen edit to make another change.');
      } else {
        setConflict(false);
        setActionError('This point is no longer in your active memory list.');
      }
    } catch (error) {
      setConflict(true);
      setActionError(errorMessage(error, 'The current version could not be loaded.'));
    }
  };

  return (
    <article className={`memory-fact-row${isDeleted ? ' memory-fact-deleted' : ''}`}>
      <div className="memory-fact-heading">
        <span className="memory-category">{fact.category || 'Uncategorized'}</span>
        <span className={`approval-status approval-${fact.approval}`}>{fact.approval === 'approved' ? 'Approved for reuse' : fact.approval === 'candidate' ? 'Needs your review' : 'Private'}</span>
        <span className={`sync-status sync-state-${fact.syncState}`}>{syncLabel(fact)}</span>
      </div>
      <p className="memory-fact-text">{fact.text}</p>
      <div className="memory-fact-meta">
        <span>{fact.source === 'manual' ? 'Added by you' : 'From your conversation'}</span>
        {fact.expiresAt && <span className={isExpired(fact.expiresAt) ? 'memory-expired' : ''}>{isExpired(fact.expiresAt) ? 'Expired' : `Expires ${formatDate(fact.expiresAt)}`}</span>}
        {isOwner && fact.sourcePartyId && fact.sourceMessageIds && fact.sourceMessageIds.length > 0 && <Link to={`/parties/${encodeURIComponent(fact.sourcePartyId)}#message-${encodeURIComponent(fact.sourceMessageIds[0])}`}>View source conversation</Link>}
      </div>
      {fact.syncState === 'error' && fact.syncError && <p className="memory-sync-error" role="status">{isDeleted ? 'Provider cleanup needs attention: ' : 'Sync needs attention: '}{fact.syncError}</p>}
      {actionError && <div className={`memory-action-message${conflict ? ' memory-conflict' : ''}`} role={conflict ? 'alert' : 'status'}><span>{actionError}</span>{conflict && <button className="text-button" type="button" onClick={() => void reloadCurrent()}>Reload current version</button>}</div>}

      {editing && !isDeleted && <form className="memory-edit-form" onSubmit={saveEdit}>
        <label className="field-label">Memory point<textarea className="text-input text-area" rows={3} maxLength={500} required value={draftText} disabled={conflict || pending} onChange={(event) => setDraftText(event.target.value)} /></label>
        <div className="memory-form-row"><label className="field-label">Category<input className="text-input" maxLength={60} value={draftCategory} disabled={conflict || pending} onChange={(event) => setDraftCategory(event.target.value)} /></label><label className="field-label">Expires<input className="text-input" type="date" value={draftExpiry} disabled={conflict || pending} onChange={(event) => setDraftExpiry(event.target.value)} /></label></div>
        <div className="memory-form-footer"><span>{draftText.length}/500</span><div><button className="button button-secondary" type="button" disabled={pending} onClick={() => { setEditing(false); setConflict(false); setActionError(''); }}>Cancel</button><button className="button button-primary" type="submit" disabled={!draftText.trim() || pending || conflict}>{updateMutation.isPending ? 'Saving…' : 'Save changes'}</button></div></div>
      </form>}

      {!isDeleted && !editing && <div className="memory-fact-actions">
        {fact.approval === 'candidate' && <><button className="text-button memory-approve" type="button" disabled={pending || conflict} onClick={() => approvalMutation.mutate(true)}>{approvalMutation.isPending ? 'Saving…' : 'Approve for reuse'}</button><button className="text-button" type="button" disabled={pending || conflict} onClick={() => approvalMutation.mutate(false)}>Keep private</button></>}
        {fact.approval === 'private' && <button className="text-button memory-approve" type="button" disabled={pending || conflict} onClick={() => approvalMutation.mutate(true)}>{approvalMutation.isPending ? 'Saving…' : 'Approve for reuse'}</button>}
        {fact.approval === 'approved' && <button className="text-button" type="button" disabled={pending || conflict} onClick={() => approvalMutation.mutate(false)}>{approvalMutation.isPending ? 'Saving…' : 'Stop sharing'}</button>}
        <button className="text-button" type="button" disabled={pending || conflict} onClick={startEdit}>Edit</button>
        {!confirmingDelete ? <button className="text-button memory-delete" type="button" disabled={pending || conflict} onClick={() => { setActionError(''); setConfirmingDelete(true); }}>Delete</button> : <span className="memory-delete-confirm"><span>Delete this point?</span><button className="text-button memory-delete" type="button" disabled={pending || conflict} onClick={() => deleteMutation.mutate()}>{deleteMutation.isPending ? 'Deleting…' : 'Confirm delete'}</button><button className="text-button" type="button" disabled={pending} onClick={() => setConfirmingDelete(false)}>Cancel</button></span>}
      </div>}
      {isDeleted && <p className="tombstone-note">Removed from your profile. {fact.syncState === 'deleting' ? 'Provider cleanup is still pending.' : ''}</p>}
    </article>
  );
}

function toDateInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function toExpiryIso(value: string) {
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

function isExpired(value: string) {
  const date = Date.parse(value);
  return Number.isFinite(date) && date < Date.now();
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function syncLabel(fact: MemoryFact) {
  if (fact.deleted && fact.syncState === 'error') return 'Cleanup needs attention';
  if (fact.deleted || fact.syncState === 'deleting') return 'Provider cleanup pending';
  if (fact.syncState === 'pending') return 'Sync pending';
  if (fact.syncState === 'processing') return 'Processing';
  if (fact.syncState === 'error') return 'Sync needs attention';
  return 'Synced';
}
