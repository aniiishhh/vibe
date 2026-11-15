import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { QueryClient, QueryClientProvider, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import QRCode from 'qrcode';
import { Amplify } from 'aws-amplify';
import { events } from 'aws-amplify/api';
import { confirmSignUp, resendSignUpCode, signIn, signUp } from 'aws-amplify/auth';
import {
  AlertCircle, ArrowDown, ArrowLeft, Check, CheckCircle2, ChevronDown, CircleHelp, Copy, Link2,
  LoaderCircle, LogOut, Menu, MessageCircle, Plus, QrCode, RefreshCw, Send, Sparkles,
  Users, X,
} from 'lucide-react';
import type { AgentRun, Member, Message, Party, Profile, SendResult } from '@vibe/shared';
import { AuthProvider, useAuth } from './auth';
import { ApiRequestError, createApi, errorMessage, type VibeApi } from './api';
import { deriveRealtimeEndpoint, type RuntimeConfig } from './runtime';
import type { RuntimeConfigResult } from './runtime';

const ApiContext = createContext<VibeApi | null>(null);

function useApi() {
  const api = useContext(ApiContext);
  if (!api) throw new Error('API context is missing');
  return api;
}

export function configureAmplify(config: RuntimeConfig) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
        loginWith: { email: true },
      },
    },
    API: {
      Events: {
        endpoint: config.eventsHttpEndpoint,
        region: config.region,
        defaultAuthMode: 'userPool',
      },
    },
  });
}

export function ConfigRequired({ result }: { result: RuntimeConfigResult }) {
  const envExample = `VITE_REGION=${import.meta.env.VITE_REGION || 'us-east-2'}
VITE_USER_POOL_ID=
VITE_USER_POOL_CLIENT_ID=
VITE_API_URL=/api
VITE_EVENTS_HTTP_ENDPOINT=
VITE_EVENTS_REALTIME_ENDPOINT=`;

  return (
    <main className="setup-screen">
      <BrandMark />
      <section className="setup-card" aria-labelledby="setup-title">
        <div className="setup-icon"><AlertCircle size={21} /></div>
        <h1 id="setup-title">Vibe needs deployment settings</h1>
        <p>Configure Cognito, the API, and AppSync Events to connect your workspace.</p>
        {result.loadError && <p className="inline-error" role="alert">{result.loadError}</p>}
        {result.missing.length > 0 && <p className="setup-missing">Missing: {result.missing.join(', ')}</p>}
        <div className="setup-instructions">
          <strong>For local development</strong>
        <p>Copy this to <code>web/.env.local</code>, then fill in the deployed values. Production uses the generated <code>/config.json</code>.</p>
          <pre><code>{envExample}</code></pre>
        </div>
        <button className="button button-secondary" onClick={() => window.location.reload()} type="button">
          <RefreshCw size={16} /> Check settings again
        </button>
      </section>
    </main>
  );
}

export function App({ config }: { config: RuntimeConfig }) {
  const api = useMemo(() => createApi(config), [config]);
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: true, refetchOnReconnect: true, staleTime: 0 },
      mutations: { retry: false },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={api}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/signin" element={<SignInPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/confirm" element={<ConfirmPage />} />
              <Route path="/invite/:token" element={<InvitePage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<WorkspaceShell />}>
                  <Route index element={<WorkspaceHome />} />
                  <Route path="parties/:partyId" element={<PartyRoute config={config} />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ApiContext.Provider>
    </QueryClientProvider>
  );
}


function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-lockup${compact ? ' brand-compact' : ''}`} aria-label="Vibe">
      <span className="brand-symbol" aria-hidden="true">v</span>
      {!compact && <span className="brand-name">vibe</span>}
    </span>
  );
}

function ProtectedRoute() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <LoadingScreen label="Restoring your session" />;
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/signin?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}

function LoadingScreen({ label }: { label: string }) {
  return <main className="loading-screen"><LoaderCircle className="spin" size={21} /><span>{label}</span></main>;
}

function WorkspaceShell() {
  const api = useApi();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [newPartyOpen, setNewPartyOpen] = useState(false);
  const partiesQuery = useQuery({ queryKey: ['parties'], queryFn: async () => (await api.listParties()).parties });
  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: api.getProfile });

  useEffect(() => {
    if (location.pathname === '/' && partiesQuery.isSuccess && partiesQuery.data.length > 0) {
      navigate(`/parties/${encodeURIComponent(partiesQuery.data[0].id)}`, { replace: true });
    }
  }, [location.pathname, navigate, partiesQuery.data, partiesQuery.isSuccess]);

  const onSignOut = async () => {
    await auth.signOut();
    queryClient.clear();
    navigate('/signin', { replace: true });
  };

  return (
    <div className="workspace-shell">
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <Sidebar
        parties={partiesQuery.data ?? []}
        activePartyId={params.partyId}
        profile={profileQuery.data}
        profileLoading={profileQuery.isPending}
        profileError={profileQuery.isError}
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onCreateParty={() => setNewPartyOpen(true)}
        onSignOut={onSignOut}
        onRetryProfile={() => void profileQuery.refetch()}
      />
      <div className="workspace-main">
        <div className="mobile-topbar">
          <button className="icon-button" type="button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={19} /></button>
          <BrandMark />
          <span className="mobile-topbar-spacer" />
          {params.partyId && <span className="mobile-party-marker"><MessageCircle size={16} /></span>}
        </div>
        <Outlet />
      </div>
      <CreatePartyDialog open={newPartyOpen} onOpenChange={setNewPartyOpen} />
    </div>
  );
}

function Sidebar({
  parties, activePartyId, profile, profileLoading, profileError, open, onClose, onCreateParty, onSignOut, onRetryProfile,
}: {
  parties: Party[];
  activePartyId?: string;
  profile?: Profile;
  profileLoading: boolean;
  profileError: boolean;
  open: boolean;
  onClose: () => void;
  onCreateParty: () => void;
  onSignOut: () => Promise<void>;
  onRetryProfile: () => void;
}) {
  return (
    <aside className={`sidebar${open ? ' sidebar-open' : ''}`} aria-label="Main navigation">
      <div className="sidebar-top">
        <Link to="/" className="sidebar-brand" aria-label="Vibe home" onClick={onClose}><BrandMark /></Link>
        <button className="icon-button sidebar-close" aria-label="Close navigation" type="button" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="sidebar-section-heading">
        <span>Your parties</span>
        <button className="icon-button small-icon-button" type="button" aria-label="Create a party" title="Create a party" onClick={onCreateParty}><Plus size={16} /></button>
      </div>
      <nav className="party-nav" aria-label="Parties">
        {parties.map((party) => (
          <Link
            className={`party-nav-item${party.id === activePartyId ? ' party-nav-active' : ''}`}
            key={party.id}
            to={`/parties/${encodeURIComponent(party.id)}`}
            onClick={onClose}
          >
            <span className="party-nav-icon"><MessageCircle size={16} /></span>
            <span className="party-nav-copy"><span className="party-nav-name">{party.name}</span><span className="party-nav-goal">{party.goal}</span></span>
          </Link>
        ))}
        {parties.length === 0 && <p className="sidebar-empty">Your parties will show up here.</p>}
      </nav>
      <div className="sidebar-bottom">
        {profileError && <div className="profile-load-error"><span>Profile unavailable</span><button type="button" onClick={onRetryProfile}>Retry</button></div>}
        <div className="account-row">
          {profileLoading ? <span className="avatar avatar-skeleton" aria-label="Loading profile" /> : <Avatar name={profile?.name || 'Your account'} />}
          <span className="account-copy">
            <strong>{profileLoading ? 'Loading profile' : profile?.name || 'Your account'}</strong>
            <span>{profile?.email || (profileLoading ? ' ' : '')}</span>
          </span>
          <button className="icon-button account-signout" type="button" aria-label="Sign out" title="Sign out" onClick={() => void onSignOut()}><LogOut size={16} /></button>
        </div>
      </div>
    </aside>
  );
}

function WorkspaceHome() {
  const api = useApi();
  const partiesQuery = useQuery({ queryKey: ['parties'], queryFn: async () => (await api.listParties()).parties });
  const [createOpen, setCreateOpen] = useState(false);
  if (partiesQuery.isPending) return <main className="home-state"><div className="home-loader"><span className="skeleton skeleton-heading" /><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line short" /></div></main>;
  if (partiesQuery.isError) return <main className="home-state"><ErrorState title="Your parties didn’t load" message={errorMessage(partiesQuery.error)} onRetry={() => void partiesQuery.refetch()} /></main>;
  return (
    <>
      <main className="home-state">
        <div className="home-empty-mark"><Users size={22} /></div>
        <h1>Make a little room for a big idea.</h1>
        <p>Start a party around a shared goal. Invite your people, keep the conversation in one place, and bring Vibe in whenever you want a hand.</p>
        <button className="button button-primary" onClick={() => setCreateOpen(true)} type="button"><Plus size={17} /> Create your first party</button>
      </main>
      <CreatePartyDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

function Avatar({ name, size = 'regular' }: { name: string; size?: 'regular' | 'small' }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase() || '?';
  return <span className={`avatar${size === 'small' ? ' avatar-small' : ''}`} aria-label={name}>{initials}</span>;
}

function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <section className="error-state" role="alert">
      <div className="error-icon"><AlertCircle size={19} /></div>
      <div><h2>{title}</h2><p>{message}</p></div>
      <button className="button button-secondary" type="button" onClick={onRetry}><RefreshCw size={15} /> Try again</button>
    </section>
  );
}

function CreatePartyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const createMutation = useMutation({
    mutationFn: api.createParty,
    onSuccess: async (party) => {
      await queryClient.invalidateQueries({ queryKey: ['parties'] });
      setName('');
      setGoal('');
      onOpenChange(false);
      navigate(`/parties/${encodeURIComponent(party.id)}`);
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() && goal.trim()) createMutation.mutate({ name: name.trim(), goal: goal.trim() });
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!createMutation.isPending) onOpenChange(next); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Close className="dialog-close icon-button" aria-label="Close"><X size={18} /></Dialog.Close>
          <Dialog.Title className="dialog-title">Start a party</Dialog.Title>
          <Dialog.Description className="dialog-description">Give your group a name and a goal. You can invite people next.</Dialog.Description>
          <form className="form-stack" onSubmit={submit}>
            <label className="field-label">Party name<input className="text-input" autoFocus maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Weekend in San Diego" /></label>
            <label className="field-label">Shared goal<textarea className="text-input text-area" maxLength={280} required rows={3} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="What would you like to figure out together?" /></label>
            {createMutation.isError && <p className="inline-error" role="alert">{errorMessage(createMutation.error, 'The party could not be created.')}</p>}
            <div className="dialog-actions"><Dialog.Close asChild><button className="button button-secondary" type="button" disabled={createMutation.isPending}>Cancel</button></Dialog.Close><button className="button button-primary" type="submit" disabled={!name.trim() || !goal.trim() || createMutation.isPending}>{createMutation.isPending ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Create party</button></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function InvitePage() {
  const { token = '' } = useParams();
  const { user, ready } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const joinMutation = useMutation({
    mutationFn: () => api.joinInvite(token),
    onSuccess: async (party) => {
      await queryClient.invalidateQueries({ queryKey: ['parties'] });
      navigate(`/parties/${encodeURIComponent(party.id)}`, { replace: true });
    },
  });
  const returnTo = `/invite/${encodeURIComponent(token)}`;

  return (
    <main className="auth-page invite-page">
      <div className="auth-brand"><BrandMark /></div>
      <section className="auth-card invite-card">
        <span className="invite-icon"><Link2 size={21} /></span>
        <h1>You’re invited to a party</h1>
        <p>Sign in or create an account, then choose to join. Vibe will check that this invitation is still valid.</p>
        {joinMutation.isError && <p className="inline-error" role="alert">{errorMessage(joinMutation.error, 'This invitation could not be used.')}</p>}
        {!ready ? <div className="form-loading"><LoaderCircle className="spin" size={18} /> Checking your session</div> : user ? (
          <button className="button button-primary button-full" type="button" disabled={joinMutation.isPending} onClick={() => joinMutation.mutate()}>{joinMutation.isPending ? <LoaderCircle className="spin" size={16} /> : <Users size={16} />} Join party</button>
        ) : <div className="auth-actions"><Link className="button button-primary button-full" to={`/signin?next=${encodeURIComponent(returnTo)}`}>Sign in to join</Link><Link className="button button-secondary button-full" to={`/signup?next=${encodeURIComponent(returnTo)}`}>Create an account</Link></div>}
        <Link className="back-link" to="/"><ArrowLeft size={15} /> Back to Vibe</Link>
      </section>
    </main>
  );
}

function SignInPage() {
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const next = safeNext(new URLSearchParams(location.search).get('next'));
  return <AuthForm mode="signin" next={next} notice={notice} />;
}

function SignUpPage() {
  const location = useLocation();
  const next = safeNext(new URLSearchParams(location.search).get('next'));
  return <AuthForm mode="signup" next={next} />;
}

function safeNext(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}

function AuthForm({ mode, next, notice }: { mode: 'signin' | 'signup'; next: string; notice?: string }) {
  const isSignUp = mode === 'signup';
  const auth = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (isSignUp) {
        const result = await signUp({
          username: normalizedEmail,
          password,
          options: { userAttributes: { email: normalizedEmail, name: name.trim() } },
        });
        if (result.isSignUpComplete) {
          navigate(`/signin?next=${encodeURIComponent(next)}`, { replace: true, state: { notice: 'Your account is ready. Sign in to continue.' } });
        } else {
          navigate(`/confirm?email=${encodeURIComponent(normalizedEmail)}&next=${encodeURIComponent(next)}`, { replace: true });
        }
      } else {
        const result = await signIn({ username: normalizedEmail, password });
        if (result.isSignedIn) {
          await auth.refresh();
          navigate(next, { replace: true });
        } else if (result.nextStep.signInStep === 'CONFIRM_SIGN_UP') {
          navigate(`/confirm?email=${encodeURIComponent(normalizedEmail)}&next=${encodeURIComponent(next)}`, { replace: true });
        } else {
          setError('Your sign-in needs another verification step. Check the email tied to this account.');
        }
      }
    } catch (caught) {
      const name = (caught as { name?: string })?.name;
      if (!isSignUp && name === 'UserNotConfirmedException') {
        navigate(`/confirm?email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent(next)}`, { replace: true });
      } else {
        setError(authError(caught));
      }
    } finally {
      setBusy(false);
    }
  };

  const modeLabel = isSignUp ? 'Create your account' : 'Welcome back';
  return (
    <main className="auth-page">
      <div className="auth-brand"><Link to="/"><BrandMark /></Link></div>
      <section className="auth-card" aria-labelledby="auth-title">
        <h1 id="auth-title">{modeLabel}</h1>
        <p>{isSignUp ? 'Bring your people together around something you want to do.' : 'Sign in to pick up where your parties left off.'}</p>
        {notice && <p className="inline-success" role="status"><CheckCircle2 size={16} /> {notice}</p>}
        {error && <p className="inline-error" role="alert">{error}</p>}
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          {isSignUp && <label className="field-label">Your name<input className="text-input" autoComplete="name" autoFocus maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} placeholder="How should people know you?" /></label>}
          <label className="field-label">Email<input className="text-input" autoComplete="email" autoFocus={!isSignUp} required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <label className="field-label">Password<input className="text-input" autoComplete={isSignUp ? 'new-password' : 'current-password'} required type="password" minLength={isSignUp ? 12 : 1} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignUp ? 'At least 12 characters' : 'Your password'} />{isSignUp && <span className="field-help">Use 12 or more characters with uppercase, lowercase, a number, and a symbol.</span>}</label>
          <button className="button button-primary button-full" type="submit" disabled={busy || !email.trim() || !password || (isSignUp && !name.trim())}>{busy ? <LoaderCircle className="spin" size={16} /> : null}{isSignUp ? 'Create account' : 'Sign in'}</button>
        </form>
        <div className="auth-switch">{isSignUp ? 'Already have an account?' : 'New to Vibe?'} <Link to={`${isSignUp ? '/signin' : '/signup'}?next=${encodeURIComponent(next)}`}>{isSignUp ? 'Sign in' : 'Create an account'}</Link></div>
      </section>
      <p className="auth-footnote">Your account keeps your party membership consistent across visits.</p>
    </main>
  );
}

function authError(error: unknown) {
  const name = (error as { name?: string })?.name;
  if (name === 'NotAuthorizedException') return 'That email and password combination didn’t match.';
  if (name === 'UsernameExistsException') return 'An account already uses this email. Try signing in.';
  if (name === 'InvalidPasswordException' || name === 'PasswordLimitExceededException') return 'Choose a password that meets your account’s password rules.';
  if (name === 'CodeMismatchException') return 'That verification code didn’t match. Check it and try again.';
  if (name === 'ExpiredCodeException') return 'That verification code expired. Request a new one.';
  if (name === 'UserNotFoundException') return 'No account was found for that email.';
  return errorMessage(error, 'Authentication could not be completed. Try again.');
}

function ConfirmPage() {
  const [searchParams] = useLocationSearchParams();
  const email = searchParams.get('email') ?? '';
  const next = safeNext(searchParams.get('next'));
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await confirmSignUp({ username: email, confirmationCode: code.trim() });
      navigate(`/signin?next=${encodeURIComponent(next)}`, { replace: true, state: { notice: 'Email confirmed. Sign in to continue.' } });
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await resendSignUpCode({ username: email });
      setNotice('A new verification code is on its way.');
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-brand"><Link to="/"><BrandMark /></Link></div>
      <section className="auth-card" aria-labelledby="confirm-title">
        <div className="auth-step-icon"><CheckCircle2 size={21} /></div>
        <h1 id="confirm-title">Check your email</h1>
        <p>Enter the confirmation code sent to <strong>{email || 'your email address'}</strong>.</p>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {notice && <p className="inline-success" role="status"><CheckCircle2 size={16} /> {notice}</p>}
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          <label className="field-label">Confirmation code<input className="text-input code-input" autoComplete="one-time-code" autoFocus required inputMode="numeric" maxLength={12} value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter code" /></label>
          <button className="button button-primary button-full" type="submit" disabled={busy || !code.trim()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} Confirm email</button>
        </form>
        <button className="text-button resend-button" type="button" disabled={busy || !email} onClick={() => void resend()}>Send a new code</button>
      </section>
      <p className="auth-footnote"><Link to={`/signin?next=${encodeURIComponent(next)}`}><ArrowLeft size={14} /> Back to sign in</Link></p>
    </main>
  );
}

function useLocationSearchParams() {
  const location = useLocation();
  return [useMemo(() => new URLSearchParams(location.search), [location.search])] as const;
}

type EventsState = 'connecting' | 'live' | 'offline' | 'mismatch';

function PartyPage({ config }: { config: RuntimeConfig }) {
  const { partyId = '' } = useParams();
  const api = useApi();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const partyQuery = useQuery({ queryKey: ['party', partyId], queryFn: () => api.getParty(partyId), enabled: Boolean(partyId) });
  const membersQuery = useQuery({ queryKey: ['members', partyId], queryFn: async () => (await api.getMembers(partyId)).members, enabled: Boolean(partyId) });
  const [eventsState, setEventsState] = useState<EventsState>('connecting');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [localRuns, setLocalRuns] = useState<AgentRun[]>([]);

  const refreshParty = () => {
    void queryClient.invalidateQueries({ queryKey: ['messages', partyId] });
    void queryClient.invalidateQueries({ queryKey: ['party', partyId] });
    void queryClient.invalidateQueries({ queryKey: ['members', partyId] });
    void queryClient.invalidateQueries({ queryKey: ['parties'] });
  };

  useEffect(() => {
    let cancelled = false;
    let channel: Awaited<ReturnType<typeof events.connect>> | undefined;
    setEventsState('connecting');

    const expectedRealtime = deriveRealtimeEndpoint(config.eventsHttpEndpoint);
    if (!expectedRealtime || normalizeEndpoint(expectedRealtime) !== normalizeEndpoint(config.eventsRealtimeEndpoint)) {
      setEventsState('mismatch');
      return;
    }

    const connect = async () => {
      try {
        const connection = await events.connect(`/party/${partyId}`, { authMode: 'userPool' });
        if (cancelled) {
          connection.close();
          return;
        }
        channel = connection;
        const subscription = connection.subscribe({
          next: () => {
            if (!cancelled) {
              setEventsState('live');
              refreshParty();
            }
          },
          error: () => {
            if (!cancelled) setEventsState('offline');
          },
        }, { authMode: 'userPool' });

        const timeout = new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Subscription acknowledgement timed out.')), 8_000));
        try {
          await Promise.race([subscription.ready, timeout]);
          if (!cancelled) setEventsState('live');
        } catch {
          if (!cancelled) setEventsState('offline');
        }
      } catch {
        if (!cancelled) setEventsState('offline');
      }
    };

    void connect();
    return () => {
      cancelled = true;
      channel?.close();
    };
  }, [config.eventsHttpEndpoint, config.eventsRealtimeEndpoint, partyId]);

  if (partyQuery.isPending) return <main className="party-loading"><div className="party-header-skeleton"><span className="skeleton skeleton-heading" /><span className="skeleton skeleton-line short" /></div><div className="chat-skeleton"><span className="skeleton message-skeleton left" /><span className="skeleton message-skeleton right" /><span className="skeleton message-skeleton left wide" /></div></main>;
  if (partyQuery.isError) return <main className="party-error"><ErrorState title="This party didn’t load" message={errorMessage(partyQuery.error)} onRetry={() => void partyQuery.refetch()} /></main>;
  if (!partyQuery.data) return <main className="party-error"><h1>Party not found</h1><p>It may have been removed, or your membership may have changed.</p><Link className="button button-secondary" to="/">Back to your parties</Link></main>;

  return (
    <div className="party-workspace">
      <PartyHeader
        party={partyQuery.data}
        members={membersQuery.data ?? []}
        membersLoading={membersQuery.isPending}
        membersError={membersQuery.isError}
        currentUserId={user?.id ?? ''}
        eventsState={eventsState}
        onInvite={() => setInviteOpen(true)}
        onRetryMembers={() => void membersQuery.refetch()}
      />
      <ChatPanel
        party={partyQuery.data}
        currentUserId={user?.id ?? ''}
        localMessages={localMessages}
        setLocalMessages={setLocalMessages}
        localRuns={localRuns}
        setLocalRuns={setLocalRuns}
      />
      <InviteDialog party={partyQuery.data} open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

function normalizeEndpoint(value: string) {
  try {
    const endpoint = new URL(value);
    return `${endpoint.protocol}//${endpoint.host}${endpoint.pathname.replace(/\/$/, '')}`;
  } catch {
    return value;
  }
}

function PartyRoute({ config }: { config: RuntimeConfig }) {
  const { partyId = '' } = useParams();
  return <PartyPage key={partyId} config={config} />;
}

function PartyHeader({
  party, members, membersLoading, membersError, currentUserId, eventsState, onInvite, onRetryMembers,
}: {
  party: Party;
  members: Member[];
  membersLoading: boolean;
  membersError: boolean;
  currentUserId: string;
  eventsState: EventsState;
  onInvite: () => void;
  onRetryMembers: () => void;
}) {
  return (
    <header className="party-header">
      <div className="party-title-block">
        <h1>{party.name}</h1>
        <p>{party.goal}</p>
      </div>
      <div className="party-actions">
        <div className={`sync-indicator sync-${eventsState}`} title={eventsState === 'live' ? 'Live updates are connected' : 'Vibe will refresh this party while it is open'}>
          <span className="sync-dot" />
          <span>{eventsState === 'live' ? 'Live' : eventsState === 'connecting' ? 'Connecting' : 'Syncing'}</span>
        </div>
        <MemberRoster members={members} loading={membersLoading} failed={membersError} currentUserId={currentUserId} partyId={party.id} onRetry={onRetryMembers} />
        <button className="button button-secondary invite-button" type="button" onClick={onInvite}><Link2 size={16} /> Invite</button>
      </div>
    </header>
  );
}

function MemberRoster({ members, loading, failed, currentUserId, partyId, onRetry }: {
  members: Member[];
  loading: boolean;
  failed: boolean;
  currentUserId: string;
  partyId: string;
  onRetry: () => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [rosterError, setRosterError] = useState('');
  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.removeMember(partyId, userId),
    onSuccess: async () => {
      setConfirmRemove(null);
      setRosterError('');
      await queryClient.invalidateQueries({ queryKey: ['members', partyId] });
      await queryClient.invalidateQueries({ queryKey: ['parties'] });
    },
    onError: (error) => setRosterError(errorMessage(error, 'This member could not be removed.')),
  });
  const currentMember = members.find((member) => member.userId === currentUserId);
  const canManage = currentMember?.role === 'owner';

  return (
    <details className="member-menu">
      <summary aria-label={loading ? 'Members loading' : `${members.length} party members`}>
        <span className="member-avatars">
          {members.slice(0, 3).map((member) => <Avatar key={member.userId} name={member.name} size="small" />)}
          {members.length > 3 && <span className="avatar avatar-small avatar-overflow">+{members.length - 3}</span>}
        </span>
        <span className="member-count">{loading ? 'People' : `${members.length} people`}</span>
        <ChevronDown size={14} />
      </summary>
      <div className="member-popover" aria-label="Party members">
        <div className="member-popover-heading"><strong>People in this party</strong><span>{loading ? '…' : members.length}</span></div>
        {loading ? <div className="popover-loading"><LoaderCircle className="spin" size={15} /> Loading members</div> : failed ? <div className="popover-error"><span>Members couldn’t load.</span><button type="button" onClick={onRetry}>Retry</button></div> : members.length === 0 ? <p className="popover-empty">No members are available.</p> : (
          <ul className="member-list">
            {members.map((member) => {
              const removable = canManage && member.role !== 'owner' && member.userId !== currentUserId;
              const isConfirming = confirmRemove === member.userId;
              return (
                <li key={member.userId}>
                  <Avatar name={member.name} size="small" />
                  <span className="member-copy"><strong>{member.name}{member.userId === currentUserId ? ' · You' : ''}</strong><span>{member.role === 'owner' ? 'Owner' : 'Member'}</span></span>
                  {removable && !isConfirming && <button className="remove-member-button" type="button" onClick={() => { setRosterError(''); setConfirmRemove(member.userId); }}>Remove</button>}
                  {removable && isConfirming && <span className="remove-confirm"><button type="button" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate(member.userId)}>{removeMutation.isPending ? 'Removing…' : 'Confirm'}</button><button type="button" onClick={() => setConfirmRemove(null)}>Keep</button></span>}
                </li>
              );
            })}
          </ul>
        )}
        {rosterError && <p className="inline-error roster-error" role="alert">{rosterError}</p>}
        <p className="member-permission-note">Party access is checked by Vibe each time you load it.</p>
      </div>
    </details>
  );
}

function InviteDialog({ party, open, onOpenChange }: { party: Party; open: boolean; onOpenChange: (open: boolean) => void }) {
  const api = useApi();
  const [inviteUrl, setInviteUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [qrData, setQrData] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const inviteMutation = useMutation({
    mutationFn: () => api.createInvite(party.id),
    onSuccess: (invite) => {
      const url = `${window.location.origin}/invite/${encodeURIComponent(invite.token)}`;
      setInviteUrl(url);
      setExpiresAt(invite.expiresAt);
      setCopied(false);
      setCopyError('');
      void QRCode.toDataURL(url, { width: 224, margin: 1, color: { dark: '#26251f', light: '#ffffff' } }).then(setQrData).catch(() => setQrData(''));
    },
  });

  useEffect(() => {
    if (!open) {
      setInviteUrl('');
      setExpiresAt('');
      setQrData('');
      setCopied(false);
      setCopyError('');
      inviteMutation.reset();
    }
  }, [open]);

  const copyLink = async () => {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setCopyError('Your browser blocked clipboard access. Select and copy the link above.');
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content invite-dialog">
          <Dialog.Close className="dialog-close icon-button" aria-label="Close"><X size={18} /></Dialog.Close>
          <Dialog.Title className="dialog-title">Invite someone</Dialog.Title>
          <Dialog.Description className="dialog-description">Share a link or scan the QR code to join {party.name}.</Dialog.Description>
          {inviteUrl ? (
            <div className="invite-result">
              {qrData ? <img className="invite-qr" src={qrData} alt={`QR code for the invitation to ${party.name}`} /> : <div className="invite-qr-placeholder"><LoaderCircle className="spin" size={18} /></div>}
              <label className="field-label">Invite link<div className="copy-field"><input className="text-input invite-link-input" readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} /><button className="button button-secondary copy-button" type="button" onClick={() => void copyLink()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy'}</button></div></label>
              {expiresAt && <p className="invite-expiry">Link expires {formatDateTime(expiresAt)}.</p>}
              {copyError && <p className="inline-error" role="alert">{copyError}</p>}
            </div>
          ) : (
            <div className="invite-start">
              <span className="invite-start-icon"><QrCode size={21} /></span>
              <p>Vibe will create a shareable link that you can send to the people you want in this party.</p>
              {inviteMutation.isError && <p className="inline-error" role="alert">{errorMessage(inviteMutation.error, 'The invite link could not be created.')}</p>}
              <button className="button button-primary button-full" type="button" disabled={inviteMutation.isPending} onClick={() => inviteMutation.mutate()}>{inviteMutation.isPending ? <LoaderCircle className="spin" size={16} /> : <Link2 size={16} />} Create invite link</button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface PendingMessage {
  text: string;
  clientId: string;
  createdAt: string;
}

function ChatPanel({ party, currentUserId, localMessages, setLocalMessages, localRuns, setLocalRuns }: {
  party: Party;
  currentUserId: string;
  localMessages: Message[];
  setLocalMessages: (update: (current: Message[]) => Message[]) => void;
  localRuns: AgentRun[];
  setLocalRuns: (update: (current: AgentRun[]) => AgentRun[]) => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [pendingAttempt, setPendingAttempt] = useState<PendingMessage | null>(null);
  const [failedAttempt, setFailedAttempt] = useState<PendingMessage | null>(null);
  const [sendError, setSendError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);
  const prependRef = useRef<{ height: number; top: number } | null>(null);
  const nearBottomRef = useRef(true);
  const pagesQuery = useInfiniteQuery({
    queryKey: ['messages', party.id],
    queryFn: ({ pageParam }) => api.getMessages(party.id, pageParam ?? undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: (query) => hasUnfinishedRuns(mergeRuns(
      localRuns,
      query.state.data?.pages.flatMap((page) => page.runs) ?? [],
    )) ? 1_800 : 10_000,
  });

  const pages = pagesQuery.data?.pages ?? [];
  const messages = useMemo(() => uniqueMessages([...pages].reverse().flatMap((page) => page.messages)), [pages]);
  const runs = useMemo(() => mergeRuns(localRuns, pages.flatMap((page) => page.runs)), [localRuns, pages]);
  const visibleMessages = useMemo(() => uniqueMessages([...messages, ...localMessages]), [messages, localMessages]);
  const runsByTrigger = useMemo(() => new Map(runs.map((run) => [run.triggerMessageId, run])), [runs]);

  const sendMutation = useMutation({
    mutationFn: (attempt: PendingMessage) => api.sendMessage(party.id, { text: attempt.text, clientId: attempt.clientId }),
    onSuccess: async (result: SendResult, attempt) => {
      setLocalMessages((current) => uniqueMessages([...current, result.message]));
      if (result.run) setLocalRuns((current) => mergeRuns(current, [result.run!]));
      setPendingAttempt(null);
      setFailedAttempt(null);
      setSendError('');
      setDraft((current) => current === attempt.text ? '' : current);
      await queryClient.invalidateQueries({ queryKey: ['messages', party.id] });
    },
    onError: (error, attempt) => {
      setPendingAttempt(null);
      setFailedAttempt(attempt);
      setDraft(attempt.text);
      setSendError(errorMessage(error, 'Your message could not be sent. Try again.'));
    },
  });

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    if (prependRef.current) {
      const before = prependRef.current;
      scroller.scrollTop = before.top + scroller.scrollHeight - before.height;
      prependRef.current = null;
      nearBottomRef.current = false;
    } else if (nearBottomRef.current) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [visibleMessages.length, pendingAttempt?.clientId, failedAttempt?.clientId]);

  useEffect(() => {
    if (!localMessages.length) return;
    const loadedIds = new Set(messages.map((message) => message.id));
    if (localMessages.some((message) => loadedIds.has(message.id))) {
      setLocalMessages((current) => current.filter((message) => !loadedIds.has(message.id)));
    }
  }, [localMessages, messages, setLocalMessages]);

  const runAttempt = (attempt: PendingMessage) => {
    setSendError('');
    setPendingAttempt(attempt);
    sendMutation.mutate(attempt);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sendMutation.isPending || failedAttempt) return;
    runAttempt({ text, clientId: crypto.randomUUID(), createdAt: new Date().toISOString() });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      composeRef.current?.form?.requestSubmit();
    }
  };

  const addMention = () => {
    setDraft((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}@Vibe `);
    composeRef.current?.focus();
  };

  const loadEarlier = async () => {
    const scroller = scrollRef.current;
    if (!scroller || !pagesQuery.hasNextPage || pagesQuery.isFetchingNextPage) return;
    prependRef.current = { height: scroller.scrollHeight, top: scroller.scrollTop };
    await pagesQuery.fetchNextPage();
  };

  const onScroll = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    nearBottomRef.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 100;
  };

  return (
    <section className="chat-panel" aria-label={`Conversation in ${party.name}`}>
      <div className="message-scroll" ref={scrollRef} onScroll={onScroll}>
        {pagesQuery.isPending ? <MessageSkeleton /> : pagesQuery.isError ? (
          <ErrorState title="Messages didn’t load" message={errorMessage(pagesQuery.error)} onRetry={() => void pagesQuery.refetch()} />
        ) : (
          <>
            {pagesQuery.hasNextPage && <div className="load-earlier-row"><button className="text-button load-earlier" type="button" disabled={pagesQuery.isFetchingNextPage} onClick={() => void loadEarlier()}>{pagesQuery.isFetchingNextPage ? <LoaderCircle className="spin" size={15} /> : <ArrowDown size={15} />} Load earlier messages</button></div>}
            {visibleMessages.length === 0 && !pendingAttempt && !failedAttempt ? <EmptyConversation onMention={addMention} /> : (
              <div className="message-list">
                {visibleMessages.map((message) => <MessageRow key={message.id} message={message} isSelf={message.authorId === currentUserId} run={runsByTrigger.get(message.id)} />)}
                {pendingAttempt && <PendingMessageRow attempt={pendingAttempt} status="sending" />}
                {failedAttempt && <PendingMessageRow attempt={failedAttempt} status="failed" />}
                {pagesQuery.isFetching && !pagesQuery.isFetchingNextPage && <div className="refresh-indicator"><LoaderCircle className="spin" size={14} /> Checking for new messages</div>}
              </div>
            )}
          </>
        )}
        <div className="scroll-bottom-anchor" />
      </div>
      <form className="composer-area" onSubmit={submit}>
        {failedAttempt && <div className="composer-error" role="alert"><AlertCircle size={15} /><span>{sendError} The message stays here with its original send ID.</span></div>}
        <div className={`composer${failedAttempt ? ' composer-failed' : ''}`}>
          <textarea
            ref={composeRef}
            className="composer-input"
            aria-label="Message your party"
            disabled={Boolean(failedAttempt) || sendMutation.isPending}
            maxLength={4000}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message your party…"
            rows={1}
            value={draft}
          />
          <div className="composer-tools">
            <button className="mention-button" type="button" disabled={Boolean(failedAttempt)} onClick={addMention}><Sparkles size={15} /> Mention @Vibe</button>
            <span className="composer-hint">{draft.length >= 3800 ? `${draft.length}/4000 · ` : ''}Enter to send · Shift + Enter for a new line</span>
            {failedAttempt && <><button className="button button-secondary retry-send" type="button" disabled={sendMutation.isPending} onClick={() => runAttempt(failedAttempt)}><RefreshCw size={15} /> Retry</button><button className="text-button edit-failed" type="button" disabled={sendMutation.isPending} title="Editing creates a new send ID" onClick={() => { setFailedAttempt(null); setSendError(''); composeRef.current?.focus(); }}>Edit draft</button></>}
            {!failedAttempt && <button className="send-button" type="submit" aria-label="Send message" title="Send message" disabled={!draft.trim() || sendMutation.isPending}>{sendMutation.isPending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}</button>}
          </div>
        </div>
      </form>
    </section>
  );
}

function uniqueMessages(messages: Message[]) {
  const byId = new Map<string, Message>();
  messages.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function mergeRuns(...groups: AgentRun[][]) {
  const byId = new Map<string, AgentRun>();
  groups.forEach((group) => group.forEach((run) => byId.set(run.id, run)));
  return [...byId.values()];
}

function hasUnfinishedRuns(runs: AgentRun[]) {
  return runs.some((run) => run.status === 'queued' || run.status === 'thinking');
}

function MessageSkeleton() {
  return <div className="message-skeleton-stack" aria-label="Loading messages"><span className="skeleton message-skeleton left" /><span className="skeleton message-skeleton right" /><span className="skeleton message-skeleton left wide" /><span className="skeleton message-skeleton right" /></div>;
}

function EmptyConversation({ onMention }: { onMention: () => void }) {
  return (
    <div className="conversation-empty">
      <div className="conversation-empty-mark"><MessageCircle size={22} /></div>
      <h2>Every good plan starts somewhere.</h2>
      <p>Say hello, share what you’re thinking, or ask Vibe to help you get unstuck.</p>
      <button className="button button-secondary" type="button" onClick={onMention}><Sparkles size={16} /> Ask Vibe a question</button>
    </div>
  );
}

const markdownComponents: Components = {
  a: ({ href, children }) => {
    const isExternal = href?.startsWith('http://') || href?.startsWith('https://');
    return <a href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noopener noreferrer' : undefined}>{children}</a>;
  },
};

function MessageRow({ message, isSelf, run }: { message: Message; isSelf: boolean; run?: AgentRun }) {
  const isAssistant = message.role === 'assistant';
  const statusText = run?.status === 'queued' ? 'Vibe is in the queue…' : run?.status === 'thinking' ? 'Vibe is thinking…' : '';
  const time = formatTime(message.createdAt);
  return (
    <article className={`message-row${isSelf ? ' message-self' : ''}${isAssistant ? ' message-assistant' : ''}`}>
      {(!isSelf || isAssistant) && <span className={`message-avatar${isAssistant ? ' message-avatar-vibe' : ''}`} aria-hidden="true">{isAssistant ? 'v' : <Avatar name={message.authorName} size="small" />}</span>}
      <div className="message-column">
        <div className="message-meta"><strong>{isAssistant ? 'Vibe' : isSelf ? 'You' : message.authorName}</strong><time dateTime={message.createdAt}>{time}</time></div>
        <div className="message-bubble">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{message.text}</ReactMarkdown>
        </div>
        {statusText && <p className="run-status"><LoaderCircle className="spin" size={13} /> {statusText}</p>}
        {run?.status === 'failed' && <p className="run-failure"><AlertCircle size={14} /><span>Vibe couldn’t finish{run.error ? `: ${run.error}` : '.'}</span></p>}
        {run?.status === 'cancelled' && <p className="run-cancelled">Vibe’s response was cancelled.</p>}
      </div>
    </article>
  );
}

function PendingMessageRow({ attempt, status }: {
  attempt: PendingMessage;
  status: 'sending' | 'failed';
}) {
  return (
    <article className="message-row message-self pending-message-row">
      <div className="message-column">
        <div className="message-meta"><strong>You</strong><time dateTime={attempt.createdAt}>{formatTime(attempt.createdAt)}</time></div>
        <div className="message-bubble"><p>{attempt.text}</p></div>
        <p className={`pending-state${status === 'failed' ? ' pending-state-error' : ''}`}>{status === 'sending' ? <><LoaderCircle className="spin" size={13} /> Sending</> : <><AlertCircle size={13} /> Not sent</>}</p>
        {status === 'failed' && <span className="pending-hint">Retry this message or edit its draft below.</span>}
      </div>
    </article>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

