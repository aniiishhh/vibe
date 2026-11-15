import { PartyTasks } from './PartyTasks';
import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
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
  AlertCircle, ArrowLeft, ArrowUp, Check, CheckCircle2, ChevronUp, Copy, Link2, LoaderCircle, LogOut,
  Monitor, Moon, NotebookText, PanelLeft, PanelRight, QrCode, RefreshCw, SquarePen, Sun, X,
} from 'lucide-react';
import type { AgentRun, Member, Message, Party, PartyFact, PartyNoteKind, Profile, SendResult } from '@vibe/shared';
import { AuthProvider, useAuth } from './auth';
import { ApiRequestError, createApi, errorMessage, type VibeApi } from './api';
import { deriveRealtimeEndpoint, type RuntimeConfig } from './runtime';
import type { RuntimeConfigResult } from './runtime';
import { BrandLockup, VibeAvatar, VibeMark } from './brand';
import { ConfettiBurst } from './burst';
import { setPipEnabled, usePipEnabled } from './pip-settings';
import { BackdropIllustration, BackdropSwatch, backdrops, backdropStyle, PartyBackdrop, setBackdropOverride, usePartyBackdrop, type BackdropId } from './backdrops';
import { activeMentionQuery, highlightMentions, mentionNames, mentionPattern, VIBE_OPTION, withMentions, type MentionOption } from './mentions';
import { ShellContext, ShellNavButtons, type ShellControls } from './shell';
import { useTheme, type ThemePreference } from './theme';

const MemoryPage = lazy(() => import('./MemoryPage').then(module => ({default:module.MemoryPage})));
const MascotDock = lazy(() => import('./mascot-dock').then(module => ({default:module.MascotDock})));

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

export function BootScreen() {
  return <main className="boot-screen" aria-label="Loading Vibe"><VibeMark size={40} className="boot-mark" /></main>;
}

export function ConfigRequired({ result }: { result: RuntimeConfigResult }) {
  const envExample = `VITE_REGION=${import.meta.env.VITE_REGION || 'us-east-2'}
VITE_USER_POOL_ID=
VITE_USER_POOL_CLIENT_ID=
VITE_API_URL=/api
VITE_EVENTS_HTTP_ENDPOINT=
VITE_EVENTS_REALTIME_ENDPOINT=`;

  return (
    <main className="auth-page">
      <div className="auth-topbar"><BrandLockup /></div>
      <section className="auth-panel setup-panel" aria-labelledby="setup-title">
        <h1 id="setup-title">Deployment settings are missing</h1>
        <p className="auth-lede">Vibe needs Cognito, API and AppSync Events settings before it can connect.</p>
        {result.loadError && <p className="inline-error" role="alert">{result.loadError}</p>}
        {result.missing.length > 0 && <p className="setup-missing">Missing: {result.missing.join(', ')}</p>}
        <p className="setup-copy">For local development, copy this into <code>web/.env.local</code> and fill in the deployed values.</p>
        <pre className="setup-code"><code>{envExample}</code></pre>
        <button className="button button-secondary" onClick={() => window.location.reload()} type="button"><RefreshCw size={15} /> Check again</button>
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
  useTheme();

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
                    <Route path="memory" element={<Suspense fallback={<main className="party-loading"><p role="status">Loading personal memory…</p></main>}><MemoryPage api={api} /></Suspense>} />
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

function ProtectedRoute() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <BootScreen />;
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/signin?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}

const sidebarKey = 'vibe.sidebar.collapsed';
const mobileQuery = '(max-width: 820px)';

function readCollapsed() {
  try { return localStorage.getItem(sidebarKey) === '1'; } catch { return false; }
}

function WorkspaceShell() {
  const api = useApi();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [newParty, setNewParty] = useState<{ open: boolean; preset?: { name: string; goal: string } }>({ open: false });
  const partiesQuery = useQuery({ queryKey: ['parties'], queryFn: async () => (await api.listParties()).parties });
  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: api.getProfile });

  useEffect(() => {
    if (location.pathname === '/' && partiesQuery.isSuccess && partiesQuery.data.length > 0) {
      navigate(`/parties/${encodeURIComponent(partiesQuery.data[0].id)}`, { replace: true });
    }
  }, [location.pathname, navigate, partiesQuery.data, partiesQuery.isSuccess]);

  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

  const setCollapsedPersisted = useCallback((value: boolean) => {
    setCollapsed(value);
    try { localStorage.setItem(sidebarKey, value ? '1' : '0'); } catch { /* ignore */ }
  }, []);

  const shell = useMemo<ShellControls>(() => ({
    sidebarCollapsed: collapsed,
    openSidebar: () => {
      if (window.matchMedia(mobileQuery).matches) setMobileNavOpen(true);
      else setCollapsedPersisted(false);
    },
    createParty: (preset) => setNewParty({ open: true, preset }),
  }), [collapsed, setCollapsedPersisted]);

  const onSignOut = async () => {
    await auth.signOut();
    queryClient.clear();
    navigate('/signin', { replace: true });
  };

  const closeSidebar = () => {
    if (window.matchMedia(mobileQuery).matches) setMobileNavOpen(false);
    else setCollapsedPersisted(true);
  };

  return (
    <ShellContext.Provider value={shell}>
      <div className={`workspace-shell${collapsed ? ' sidebar-collapsed' : ''}${mobileNavOpen ? ' mobile-nav-open' : ''}`}>
        <button className="mobile-scrim" aria-label="Close sidebar" tabIndex={mobileNavOpen ? 0 : -1} onClick={() => setMobileNavOpen(false)} />
        <Sidebar
          parties={partiesQuery.data ?? []}
          partiesLoading={partiesQuery.isPending}
          activePartyId={params.partyId}
          profile={profileQuery.data}
          profileLoading={profileQuery.isPending}
          profileError={profileQuery.isError}
          onClose={closeSidebar}
          onCreateParty={() => { setMobileNavOpen(false); setNewParty({ open: true }); }}
          onSignOut={onSignOut}
          onRetryProfile={() => void profileQuery.refetch()}
        />
        <div className="workspace-main">
          <Outlet />
        </div>
        <CreatePartyDialog open={newParty.open} preset={newParty.preset} onOpenChange={(open) => setNewParty((current) => ({ ...current, open }))} />
      </div>
    </ShellContext.Provider>
  );
}

function Sidebar({
  parties, partiesLoading, activePartyId, profile, profileLoading, profileError, onClose, onCreateParty, onSignOut, onRetryProfile,
}: {
  parties: Party[];
  partiesLoading: boolean;
  activePartyId?: string;
  profile?: Profile;
  profileLoading: boolean;
  profileError: boolean;
  onClose: () => void;
  onCreateParty: () => void;
  onSignOut: () => Promise<void>;
  onRetryProfile: () => void;
}) {
  const location = useLocation();
  const onMemory = location.pathname === '/memory';
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-top">
        <Link to="/" className="sidebar-brand" aria-label="Vibe home"><BrandLockup /></Link>
        <button className="icon-button" aria-label="Close sidebar" title="Close sidebar" type="button" onClick={onClose}><PanelLeft size={18} /></button>
      </div>
      <div className="sidebar-actions">
        <button className="sidebar-link" type="button" onClick={onCreateParty}><SquarePen size={17} /><span>New party</span></button>
        <Link className={`sidebar-link${onMemory ? ' sidebar-link-active' : ''}`} to="/memory" aria-current={onMemory ? 'page' : undefined}>
          <NotebookText size={17} /><span>Personal memory</span>
        </Link>
      </div>
      <div className="sidebar-section-label">Parties</div>
      <nav className="party-nav" aria-label="Parties">
        {partiesLoading ? (
          <div className="party-nav-skeleton delayed-reveal" aria-label="Loading parties">
            {[72, 56, 64].map((width) => <span key={width} className="skeleton" style={{ width: `${width}%` }} />)}
          </div>
        ) : parties.map((party) => <PartyNavItem key={party.id} party={party} active={party.id === activePartyId} />)}
        {!partiesLoading && parties.length === 0 && <p className="sidebar-empty">No parties yet. Start one and invite your people.</p>}
      </nav>
      <div className="sidebar-bottom">
        {profileError && <div className="profile-load-error"><span>Profile didn’t load</span><button type="button" onClick={onRetryProfile}>Retry</button></div>}
        <AccountMenu profile={profile} loading={profileLoading} onSignOut={onSignOut} />
      </div>
    </aside>
  );
}

function PartyNavItem({ party, active }: { party: Party; active: boolean }) {
  const { definition } = usePartyBackdrop(party);
  return (
    <Link
      className={`party-nav-item${active ? ' party-nav-active' : ''}`}
      to={`/parties/${encodeURIComponent(party.id)}`}
      aria-current={active ? 'page' : undefined}
      title={party.goal}
    >
      <BackdropSwatch id={definition.id} size={22} />
      <span className="party-nav-name">{party.name}</span>
    </Link>
  );
}

function AccountMenu({ profile, loading, onSignOut }: { profile?: Profile; loading: boolean; onSignOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const name = profile?.name || 'Your account';
  return (
    <div className="account-menu" ref={ref}>
      {open && (
        <div className="account-popover" role="menu">
          <div className="account-popover-email">{profile?.email}</div>
          <div className="account-popover-row">
            <span>Theme</span>
            <ThemeSegmented />
          </div>
          <PipToggleRow />
          <button className="account-popover-item" type="button" role="menuitem" onClick={() => void onSignOut()}><LogOut size={16} /> Sign out</button>
        </div>
      )}
      <button className="account-row" type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>
        {loading ? <span className="avatar avatar-skeleton" /> : <Avatar name={name} />}
        <span className="account-name">{loading ? '' : name}</span>
        <ChevronUp size={16} className={`account-chevron${open ? ' account-chevron-open' : ''}`} />
      </button>
    </div>
  );
}

function PipToggleRow() {
  const enabled = usePipEnabled();
  return (
    <div className="account-popover-row">
      <span>Show Pip</span>
      <button className={`switch${enabled ? ' switch-on' : ''}`} type="button" role="switch" aria-checked={enabled} aria-label="Show Pip, the Vibe mascot" onClick={() => setPipEnabled(!enabled)}><span className="switch-thumb" /></button>
    </div>
  );
}

const themeOptions: Array<{ value: ThemePreference; label: string; icon: ReactNode }> = [
  { value: 'light', label: 'Light', icon: <Sun size={15} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={15} /> },
  { value: 'system', label: 'System', icon: <Monitor size={15} /> },
];

function ThemeSegmented() {
  const { preference, setPreference } = useTheme();
  return (
    <div className="segmented" role="radiogroup" aria-label="Theme">
      {themeOptions.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={preference === option.value} aria-label={option.label} title={option.label} className={preference === option.value ? 'segmented-on' : ''} onClick={() => setPreference(option.value)}>{option.icon}</button>
      ))}
    </div>
  );
}

function ThemeCycleButton() {
  const { preference, setPreference } = useTheme();
  const index = themeOptions.findIndex((option) => option.value === preference);
  const current = themeOptions[index];
  const next = themeOptions[(index + 1) % themeOptions.length];
  return <button className="icon-button" type="button" aria-label={`Theme: ${current.label}. Switch to ${next.label}`} title={`Theme: ${current.label}`} onClick={() => setPreference(next.value)}>{current.icon}</button>;
}

const starters = [
  { name: 'Weekend trip', goal: 'Plan where we go, where we stay and what it costs.' },
  { name: 'Classes next semester', goal: 'Find classes we can take together.' },
  { name: 'Hackathon team', goal: 'Pick an idea and split the work.' },
  { name: 'Dinner plans', goal: 'Choose a place everyone can eat at.' },
];

function WorkspaceHome() {
  const api = useApi();
  const partiesQuery = useQuery({ queryKey: ['parties'], queryFn: async () => (await api.listParties()).parties });
  const [create, setCreate] = useState<{ open: boolean; preset?: { name: string; goal: string } }>({ open: false });
  if (partiesQuery.isPending || (partiesQuery.isSuccess && partiesQuery.data.length > 0)) return <main className="home-state"><div className="page-topbar"><ShellNavButtons /></div></main>;
  if (partiesQuery.isError) return <main className="home-state"><div className="page-topbar"><ShellNavButtons /></div><ErrorState title="Your parties didn’t load" message={errorMessage(partiesQuery.error)} onRetry={() => void partiesQuery.refetch()} /></main>;
  return (
    <>
      <main className="home-state">
        <div className="page-topbar"><ShellNavButtons /></div>
        <div className="home-center">
          <h1>Start a party</h1>
          <p>A party is a group chat with a shared goal. Invite people with a link, and mention @Vibe when you want help planning, researching or deciding.</p>
          <div className="starter-grid">
            {starters.map((starter) => (
              <button key={starter.name} className="starter" type="button" onClick={() => setCreate({ open: true, preset: starter })}>
                <StarterSwatch name={starter.name} goal={starter.goal} />
                <span><strong>{starter.name}</strong><span>{starter.goal}</span></span>
              </button>
            ))}
          </div>
          <button className="text-button" type="button" onClick={() => setCreate({ open: true })}>Or start from scratch</button>
        </div>
      </main>
      <CreatePartyDialog open={create.open} preset={create.preset} onOpenChange={(open) => setCreate((current) => ({ ...current, open }))} />
    </>
  );
}

function StarterSwatch({ name, goal }: { name: string; goal: string }) {
  const { definition } = usePartyBackdrop({ id: `starter-${name}`, name, goal });
  return <BackdropSwatch id={definition.id} size={34} />;
}

function Avatar({ name, size = 'regular' }: { name: string; size?: 'regular' | 'small' }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase() || '?';
  const hue = [...name].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 7);
  return <span className={`avatar${size === 'small' ? ' avatar-small' : ''}`} style={{ '--avatar-hue': hue } as CSSProperties} aria-hidden="true">{initials}</span>;
}

function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <section className="error-state" role="alert">
      <AlertCircle size={20} className="error-state-icon" />
      <h2>{title}</h2>
      <p>{message}</p>
      <button className="button button-secondary" type="button" onClick={onRetry}><RefreshCw size={15} /> Try again</button>
    </section>
  );
}

function CreatePartyDialog({ open, preset, onOpenChange }: { open: boolean; preset?: { name: string; goal: string }; onOpenChange: (open: boolean) => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  useEffect(() => {
    if (open) {
      setName(preset?.name ?? '');
      setGoal(preset?.goal ?? '');
    }
  }, [open, preset]);
  const createMutation = useMutation({
    mutationFn: api.createParty,
    onSuccess: async (party) => {
      await queryClient.invalidateQueries({ queryKey: ['parties'] });
      onOpenChange(false);
      navigate(`/parties/${encodeURIComponent(party.id)}`);
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() && goal.trim()) createMutation.mutate({ name: name.trim(), goal: goal.trim() });
  };
  const { definition } = usePartyBackdrop({ id: 'draft', name, goal });

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!createMutation.isPending) onOpenChange(next); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Close className="dialog-close icon-button" aria-label="Close"><X size={18} /></Dialog.Close>
          <Dialog.Title className="dialog-title">New party</Dialog.Title>
          <Dialog.Description className="dialog-description">Name it and say what you’re figuring out. You’ll get an invite link next.</Dialog.Description>
          <form className="form-stack" onSubmit={submit}>
            <label className="field-label">Name<input className="text-input" autoFocus maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} placeholder="Weekend in San Diego" /></label>
            <label className="field-label">Goal<textarea className="text-input text-area" maxLength={280} required rows={3} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="What should the group decide or get done?" /></label>
            <div className="dialog-backdrop-hint"><BackdropSwatch id={definition.id} size={26} /><span>Background: <strong>{definition.label}</strong>, picked from the name and goal. You can change it later.</span></div>
            {createMutation.isError && <p className="inline-error" role="alert">{errorMessage(createMutation.error, 'The party could not be created.')}</p>}
            <div className="dialog-actions"><Dialog.Close asChild><button className="button button-secondary" type="button" disabled={createMutation.isPending}>Cancel</button></Dialog.Close><button className="button button-primary" type="submit" disabled={!name.trim() || !goal.trim() || createMutation.isPending}>{createMutation.isPending && <LoaderCircle className="spin" size={16} />} Create party</button></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <PartyBackdrop id="chill" />
      <div className="auth-topbar"><Link to="/" className="auth-brand"><BrandLockup /></Link><ThemeCycleButton /></div>
      {children}
    </main>
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
    <AuthLayout>
      <section className="auth-panel" aria-labelledby="invite-title">
        <h1 id="invite-title">You’ve been invited to a party</h1>
        <p className="auth-lede">{user ? 'Join to see the conversation and add your ideas.' : 'Sign in or create an account to join.'}</p>
        {joinMutation.isError && <p className="inline-error" role="alert">{errorMessage(joinMutation.error, 'This invitation could not be used.')}</p>}
        {!ready ? <div className="form-loading"><LoaderCircle className="spin" size={16} /> Checking your session</div> : user ? (
          <button className="button button-primary button-full" type="button" disabled={joinMutation.isPending} onClick={() => joinMutation.mutate()}>{joinMutation.isPending && <LoaderCircle className="spin" size={16} />} Join party</button>
        ) : <div className="auth-actions"><Link className="button button-primary button-full" to={`/signin?next=${encodeURIComponent(returnTo)}`}>Sign in to join</Link><Link className="button button-secondary button-full" to={`/signup?next=${encodeURIComponent(returnTo)}`}>Create an account</Link></div>}
      </section>
    </AuthLayout>
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
      const errorName = (caught as { name?: string })?.name;
      if (!isSignUp && errorName === 'UserNotConfirmedException') {
        navigate(`/confirm?email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent(next)}`, { replace: true });
      } else {
        setError(authError(caught));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <section className="auth-panel" aria-labelledby="auth-title">
        <h1 id="auth-title">{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-lede">{isSignUp ? 'Plan things with your friends, classmates and teammates, with @Vibe in the chat.' : 'Sign in to get back to your parties.'}</p>
        {notice && <p className="inline-success" role="status"><CheckCircle2 size={16} /> {notice}</p>}
        {error && <p className="inline-error" role="alert">{error}</p>}
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          {isSignUp && <label className="field-label">Name<input className="text-input" autoComplete="name" autoFocus maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} placeholder="What your party sees" /></label>}
          <label className="field-label">Email<input className="text-input" autoComplete="email" autoFocus={!isSignUp} required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <label className="field-label">Password<input className="text-input" autoComplete={isSignUp ? 'new-password' : 'current-password'} required type="password" minLength={isSignUp ? 12 : 1} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignUp ? 'At least 12 characters' : 'Your password'} />{isSignUp && <span className="field-help">12 or more characters, with uppercase, lowercase, a number and a symbol.</span>}</label>
          <button className="button button-primary button-full button-large" type="submit" disabled={busy || !email.trim() || !password || (isSignUp && !name.trim())}>{busy && <LoaderCircle className="spin" size={16} />}{isSignUp ? 'Create account' : 'Sign in'}</button>
        </form>
        <p className="auth-switch">{isSignUp ? 'Already have an account?' : 'New to Vibe?'} <Link to={`${isSignUp ? '/signin' : '/signup'}?next=${encodeURIComponent(next)}`}>{isSignUp ? 'Sign in' : 'Create an account'}</Link></p>
      </section>
    </AuthLayout>
  );
}

function authError(error: unknown) {
  const name = (error as { name?: string })?.name;
  if (name === 'NotAuthorizedException') return 'That email and password don’t match.';
  if (name === 'UsernameExistsException') return 'An account already uses this email. Try signing in.';
  if (name === 'InvalidPasswordException' || name === 'PasswordLimitExceededException') return 'Choose a password that meets the password rules.';
  if (name === 'CodeMismatchException') return 'That code didn’t match. Check it and try again.';
  if (name === 'ExpiredCodeException') return 'That code expired. Request a new one.';
  if (name === 'UserNotFoundException') return 'No account uses that email.';
  return errorMessage(error, 'Sign-in couldn’t be completed. Try again.');
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
      setNotice('We sent a new code.');
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <section className="auth-panel" aria-labelledby="confirm-title">
        <h1 id="confirm-title">Check your email</h1>
        <p className="auth-lede">Enter the code we sent to <strong>{email || 'your email address'}</strong>.</p>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {notice && <p className="inline-success" role="status"><CheckCircle2 size={16} /> {notice}</p>}
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          <label className="field-label">Confirmation code<input className="text-input code-input" autoComplete="one-time-code" autoFocus required inputMode="numeric" maxLength={12} value={code} onChange={(event) => setCode(event.target.value)} placeholder="000000" /></label>
          <button className="button button-primary button-full button-large" type="submit" disabled={busy || !code.trim()}>{busy && <LoaderCircle className="spin" size={16} />} Confirm email</button>
        </form>
        <div className="auth-switch auth-switch-split">
          <Link to={`/signin?next=${encodeURIComponent(next)}`}><ArrowLeft size={14} /> Back to sign in</Link>
          <button className="text-button" type="button" disabled={busy || !email} onClick={() => void resend()}>Send a new code</button>
        </div>
      </section>
    </AuthLayout>
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [localRuns, setLocalRuns] = useState<AgentRun[]>([]);

  const refreshParty = () => {
    void queryClient.invalidateQueries({ queryKey: ['messages', partyId] });
    void queryClient.invalidateQueries({ queryKey: ['party', partyId] });
    void queryClient.invalidateQueries({ queryKey: ['members', partyId] });
    void queryClient.invalidateQueries({ queryKey: ['party-facts', partyId] });
    void queryClient.invalidateQueries({ queryKey: ['tasks', partyId] });
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

  if (partyQuery.isPending) return <main className="party-loading"><div className="page-topbar"><ShellNavButtons /></div><div className="delayed-reveal party-loading-lines"><span className="skeleton skeleton-heading" /><span className="skeleton skeleton-line short" /></div></main>;
  if (partyQuery.isError) return <main className="party-error"><div className="page-topbar"><ShellNavButtons /></div><ErrorState title="This party didn’t load" message={errorMessage(partyQuery.error)} onRetry={() => void partyQuery.refetch()} /></main>;
  if (!partyQuery.data) return <main className="party-error"><h1>Party not found</h1><p>It may have been removed, or your membership changed.</p><Link className="button button-secondary" to="/">Back to your parties</Link></main>;

  return (
    <PartyView
      party={partyQuery.data}
      members={membersQuery.data ?? []}
      membersLoading={membersQuery.isPending}
      membersError={membersQuery.isError}
      currentUserId={user?.id ?? ''}
      eventsState={eventsState}
      inviteOpen={inviteOpen}
      setInviteOpen={setInviteOpen}
      detailsOpen={detailsOpen}
      setDetailsOpen={setDetailsOpen}
      onRetryMembers={() => void membersQuery.refetch()}
      localMessages={localMessages}
      setLocalMessages={setLocalMessages}
      localRuns={localRuns}
      setLocalRuns={setLocalRuns}
    />
  );
}

function PartyView(props: {
  party: Party;
  members: Member[];
  membersLoading: boolean;
  membersError: boolean;
  currentUserId: string;
  eventsState: EventsState;
  inviteOpen: boolean;
  setInviteOpen: (open: boolean) => void;
  detailsOpen: boolean;
  setDetailsOpen: (open: boolean) => void;
  onRetryMembers: () => void;
  localMessages: Message[];
  setLocalMessages: (update: (current: Message[]) => Message[]) => void;
  localRuns: AgentRun[];
  setLocalRuns: (update: (current: AgentRun[]) => AgentRun[]) => void;
}) {
  const { party, members, currentUserId, detailsOpen, setDetailsOpen } = props;
  const backdrop = usePartyBackdrop(party);
  return (
    <div className={`party-workspace${detailsOpen ? ' details-open' : ''}`} style={backdropStyle(backdrop.definition.id)}>
      <div className="party-main">
        <PartyHeader
          party={party}
          members={members}
          membersLoading={props.membersLoading}
          membersError={props.membersError}
          currentUserId={currentUserId}
          eventsState={props.eventsState}
          detailsOpen={detailsOpen}
          onInvite={() => props.setInviteOpen(true)}
          onToggleDetails={() => setDetailsOpen(!detailsOpen)}
          onRetryMembers={props.onRetryMembers}
        />
        <div className="party-body">
          <PartyBackdrop id={backdrop.definition.id} />
          <ChatPanel
            party={party}
            backdropId={backdrop.definition.id}
            members={members}
            currentUserId={currentUserId}
            localMessages={props.localMessages}
            setLocalMessages={props.setLocalMessages}
            localRuns={props.localRuns}
            setLocalRuns={props.setLocalRuns}
          />
        </div>
      </div>
      {detailsOpen && <button className="details-scrim" type="button" aria-label="Close party details" onClick={() => setDetailsOpen(false)} />}
      <PartyDetailsPanel
        open={detailsOpen}
        party={party}
        members={members}
        membersLoading={props.membersLoading}
        membersError={props.membersError}
        currentUserId={currentUserId}
        onClose={() => setDetailsOpen(false)}
        onRetryMembers={props.onRetryMembers}
      />
      <InviteDialog party={party} open={props.inviteOpen} onOpenChange={props.setInviteOpen} />
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
  party, members, membersLoading, eventsState, detailsOpen, onInvite, onToggleDetails,
}: {
  party: Party;
  members: Member[];
  membersLoading: boolean;
  membersError: boolean;
  currentUserId: string;
  eventsState: EventsState;
  detailsOpen: boolean;
  onInvite: () => void;
  onToggleDetails: () => void;
  onRetryMembers: () => void;
}) {
  const syncLabel = eventsState === 'live' ? 'Live updates on' : eventsState === 'connecting' ? 'Connecting' : 'Refreshing periodically';
  return (
    <header className="party-header">
      <ShellNavButtons />
      <div className="party-title-block">
        <h1>{party.name}</h1>
        <span className={`sync-dot sync-${eventsState}`} role="status" aria-label={syncLabel} title={syncLabel} />
      </div>
      <div className="party-actions">
        <button className="member-stack" type="button" onClick={onToggleDetails} aria-label={membersLoading ? 'People' : `${members.length} people in this party`} title="People">
          {members.slice(0, 3).map((member) => <Avatar key={member.userId} name={member.name} size="small" />)}
          {members.length > 3 && <span className="avatar avatar-small avatar-overflow">+{members.length - 3}</span>}
        </button>
        <button className="button button-secondary button-small" type="button" onClick={onInvite}><Link2 size={15} /> Invite</button>
        <button className={`icon-button${detailsOpen ? ' icon-button-on' : ''}`} type="button" aria-label="Party details" aria-expanded={detailsOpen} title="Party details" onClick={onToggleDetails}><PanelRight size={18} /></button>
      </div>
    </header>
  );
}

function PartyDetailsPanel({ open, party, members, membersLoading, membersError, currentUserId, onClose, onRetryMembers }: {
  open: boolean;
  party: Party;
  members: Member[];
  membersLoading: boolean;
  membersError: boolean;
  currentUserId: string;
  onClose: () => void;
  onRetryMembers: () => void;
}) {
  const api = useApi();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <aside className="details-panel" aria-label="Party details" aria-hidden={!open} inert={!open}>
      <div className="details-header">
        <h2>Details</h2>
        <button className="icon-button" type="button" aria-label="Close party details" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="details-scroll">
        <section className="details-section">
          <h3>Goal</h3>
          <p className="details-goal">{party.goal}</p>
        </section>
        <section className="details-section">
          <h3>Your memory here</h3>
          <MemorySharingControl partyId={party.id} member={members.find((item) => item.userId === currentUserId)} loading={membersLoading} failed={membersError} />
        </section>
        <section className="details-section">
          <h3>Party notes</h3>
          {open && <PartyFactsList party={party} members={members} />}
        </section>
        <section className="details-section">
          <h3>Tasks and Vibe mode</h3>
          {open && <PartyTasks api={api} party={party} members={members} viewerId={currentUserId} />}
        </section>
        <section className="details-section">
          <h3>People</h3>
          <MemberRoster members={members} loading={membersLoading} failed={membersError} currentUserId={currentUserId} partyId={party.id} onRetry={onRetryMembers} />
        </section>
        <section className="details-section">
          <h3>Background</h3>
          <BackdropPicker party={party} />
        </section>
      </div>
    </aside>
  );
}

function BackdropPicker({ party }: { party: Party }) {
  const { definition, automatic, isAutomatic } = usePartyBackdrop(party);
  const automaticLabel = backdrops.find((item) => item.id === automatic)!.label;
  return (
    <div className="backdrop-picker">
      <button type="button" className={`backdrop-option${isAutomatic ? ' backdrop-option-on' : ''}`} aria-pressed={isAutomatic} onClick={() => setBackdropOverride(party.id, null)}>
        <BackdropSwatch id={automatic} size={40} />
        <span>Auto<small>{automaticLabel}</small></span>
      </button>
      {backdrops.map((item) => (
        <button key={item.id} type="button" className={`backdrop-option${!isAutomatic && definition.id === item.id ? ' backdrop-option-on' : ''}`} aria-pressed={!isAutomatic && definition.id === item.id} onClick={() => setBackdropOverride(party.id, item.id)}>
          <BackdropSwatch id={item.id} size={40} />
          <span>{item.label}</span>
        </button>
      ))}
      <p className="details-note">Saved on this device only.</p>
    </div>
  );
}

function MemorySharingControl({ partyId, member, loading, failed }: {
  partyId: string;
  member?: Member;
  loading: boolean;
  failed: boolean;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const sharingEnabled = member?.useSharedMemory === true;
  const mutation = useMutation({
    mutationFn: (useSharedMemory: boolean) => api.updatePartyMemorySharing(partyId, useSharedMemory),
    onSuccess: async (updatedMember) => {
      setError('');
      queryClient.setQueryData<Member[]>(['members', partyId], (current = []) => current.map((item) => item.userId === updatedMember.userId ? updatedMember : item));
      await queryClient.invalidateQueries({ queryKey: ['members', partyId] });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (caught) => {
      setError(caught instanceof ApiRequestError && caught.status === 409
        ? 'This setting changed elsewhere. It has been reloaded; try again.'
        : errorMessage(caught, 'This setting could not be changed.'));
      if (caught instanceof ApiRequestError && caught.status === 409) void queryClient.invalidateQueries({ queryKey: ['members', partyId] });
    },
  });

  if (loading) return <span className="skeleton skeleton-line delayed-reveal" />;
  if (failed || !member) return <p className="details-note">This setting is unavailable right now.</p>;

  return (
    <div className="setting-row">
      <div className="setting-copy">
        <strong>Use my approved memory</strong>
        <span>Vibe can use the memory points you approved when it answers in this party.</span>
        {error && <span className="setting-error" role="alert">{error}</span>}
      </div>
      <button
        className={`switch${sharingEnabled ? ' switch-on' : ''}`}
        type="button"
        role="switch"
        aria-checked={sharingEnabled}
        aria-label="Use my approved memory in this party"
        disabled={mutation.isPending}
        onClick={() => { setError(''); mutation.mutate(!sharingEnabled); }}
      >
        <span className="switch-thumb" />
      </button>
    </div>
  );
}

const noteKinds: PartyNoteKind[] = ['decision','suggestion','constraint','question','disagreement'];

function PartyFactsList({ party, members }: { party: Party; members: Member[] }) {
  const api = useApi();
  const client = useQueryClient();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<PartyNoteKind>('suggestion');
  const factsQuery = useQuery({
    queryKey: ['party-facts', party.id],
    queryFn: async () => (await api.getPartyFacts(party.id)).facts,
    refetchInterval: 10_000,
  });
  const refresh = () => client.invalidateQueries({ queryKey: ['party-facts', party.id] });
  const create = useMutation({
    mutationFn: () => api.createPartyFact(party.id, { text: text.trim(), kind }),
    onSuccess: async () => { setText(''); await refresh(); },
  });
  return (
    <div className="party-notes-editor">
        {factsQuery.isPending ? <p>Loading party memory…</p> : factsQuery.isError ? <div role="alert">{errorMessage(factsQuery.error)} <button type="button" onClick={() => void factsQuery.refetch()}>Retry</button></div> : !factsQuery.data.length ? <p>No shared notes yet.</p> : (
          <ul className="facts-list">{factsQuery.data.filter(fact => !fact.subjectId).map(fact => <PartyNoteRow key={fact.id} fact={fact} partyId={party.id} members={members} partyOwnerId={party.ownerId} refresh={refresh} />)}{[...new Set(factsQuery.data.flatMap(fact => fact.subjectId ? [fact.subjectId] : []))].map(subjectId => <li key={subjectId}><div><h3>{factsQuery.data.find(fact => fact.subjectId === subjectId)?.subjectName ?? 'Participant'} · party notes</h3><ul>{factsQuery.data.filter(fact => fact.subjectId === subjectId).map(fact => <PartyNoteRow key={fact.id} fact={fact} partyId={party.id} members={members} partyOwnerId={party.ownerId} refresh={refresh} />)}</ul></div></li>)}</ul>
        )}
        <form className="party-note-form" onSubmit={event => { event.preventDefault(); create.mutate(); }}>
          <label>New party note<textarea maxLength={500} required value={text} onChange={event => setText(event.target.value)} /></label>
          <label>Type<select value={kind} onChange={event => setKind(event.target.value as PartyNoteKind)}>{noteKinds.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <button className="button button-secondary" type="submit" disabled={create.isPending || !text.trim()}>{create.isPending ? 'Saving…' : 'Add note'}</button>
          {create.isError && <p role="alert">{errorMessage(create.error)}</p>}
        </form>
    </div>
  );
}

function PartyNoteRow({ fact, partyId, members, partyOwnerId, refresh }: { partyOwnerId: string; fact: PartyFact; partyId: string; members: Member[]; refresh: () => Promise<unknown> }) {
  const api = useApi();
  const [editing, setEditing] = useState(false);
  const viewerId = useAuth().user?.id;
  const canEdit = viewerId === (fact.subjectId ?? (fact.source === 'manual' ? fact.speakerId : partyOwnerId));
  const [text, setText] = useState(fact.text);
  const [kind, setKind] = useState<PartyNoteKind>(fact.kind ?? 'suggestion');
  const [version, setVersion] = useState(fact.version ?? 1);
  const [participationStatus,setParticipationStatus] = useState(fact.participationStatus ?? 'unresolved');
  const save = useMutation({ mutationFn: () => api.updatePartyFact(partyId, fact.id, { text, kind, version, ...(fact.kind === 'participation' ? {participationStatus} : {}) }), onSuccess: async () => { setEditing(false); await refresh(); } });
  const remove = useMutation({ mutationFn: () => api.deletePartyFact(partyId, fact.id, fact.version ?? 1), onSuccess: refresh });
  const error = save.error ?? remove.error;
  return <li><div>
    <strong>{fact.kind === 'participation' ? `Participation · ${fact.participationStatus ?? 'unresolved'}` : fact.subjectName ? `${fact.topic ?? 'preferences'}` : fact.kind ?? 'suggestion'}</strong>
    {editing ? <form className="party-note-form" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
      <label>Note text<textarea required maxLength={500} value={text} onChange={event => setText(event.target.value)} /></label>
      <label>Type<select disabled={fact.kind === 'participation'} value={kind} onChange={event => setKind(event.target.value as PartyNoteKind)}>{fact.subjectId && <option value={fact.kind === 'participation' ? 'participation' : 'preference'}>{fact.kind === 'participation' ? 'Participation' : 'Preference'}</option>}{noteKinds.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      {fact.kind === 'participation' && <label>Participation status<select value={participationStatus} onChange={event=>setParticipationStatus(event.target.value as typeof participationStatus)}>{['suggested','confirmed','unresolved','withdrawn'].map(value=><option key={value} value={value}>{value}</option>)}</select></label>}
      <button type="submit" disabled={save.isPending || !text.trim()}>Save correction</button>
      <button type="button" onClick={() => { setEditing(false); save.reset(); }}>Cancel</button>
    </form> : <p>{fact.text}</p>}
    <small>{fact.source === 'conversation' ? 'From discussion' : 'Member recorded'} · v{fact.version ?? 1}{fact.lastEditorId ? ` · Last corrected by ${members.find(member => member.userId === fact.lastEditorId)?.name ?? 'a member'}` : ''} · <time dateTime={fact.updatedAt ?? fact.createdAt}>{new Date(fact.updatedAt ?? fact.createdAt).toLocaleString()}</time></small>
    <div className="party-note-actions">{fact.sourceMessageIds.map((id, index) => <Link key={id} to={`/parties/${encodeURIComponent(partyId)}#message-${encodeURIComponent(id)}`}>Source {index + 1}</Link>)}</div>
    {!editing && canEdit && <div className="party-note-actions"><button type="button" disabled={remove.isPending} onClick={() => { setText(fact.text); setKind(fact.kind ?? 'suggestion'); setParticipationStatus(fact.participationStatus ?? 'unresolved'); setVersion(fact.version ?? 1); save.reset(); setEditing(true); }}>Edit</button><button type="button" disabled={remove.isPending} onClick={() => remove.mutate()}>{remove.isPending ? 'Removing…' : 'Remove'}</button></div>}
    {error && <p role="alert">{errorMessage(error)} <button type="button" onClick={() => { setEditing(false); save.reset(); remove.reset(); void refresh(); }}>Reload notes</button></p>}
  </div></li>;
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
  const canManage = members.find((member) => member.userId === currentUserId)?.role === 'owner';

  if (loading) return <span className="skeleton skeleton-line delayed-reveal" />;
  if (failed) return <div className="details-error"><span>People couldn’t load.</span><button className="text-button" type="button" onClick={onRetry}>Retry</button></div>;
  return (
    <>
      <ul className="member-list">
        {members.map((member) => {
          const removable = canManage && member.role !== 'owner' && member.userId !== currentUserId;
          const isConfirming = confirmRemove === member.userId;
          return (
            <li key={member.userId}>
              <Avatar name={member.name} size="small" />
              <span className="member-copy"><strong>{member.name}{member.userId === currentUserId ? ' (you)' : ''}</strong><span>{member.role === 'owner' ? 'Owner' : 'Member'}</span></span>
              {removable && !isConfirming && <button className="text-button text-button-quiet" type="button" onClick={() => { setRosterError(''); setConfirmRemove(member.userId); }}>Remove</button>}
              {removable && isConfirming && <span className="remove-confirm"><button className="text-button text-button-danger" type="button" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate(member.userId)}>{removeMutation.isPending ? 'Removing…' : 'Remove'}</button><button className="text-button text-button-quiet" type="button" onClick={() => setConfirmRemove(null)}>Keep</button></span>}
            </li>
          );
        })}
      </ul>
      {rosterError && <p className="inline-error" role="alert">{rosterError}</p>}
    </>
  );
}

function InviteDialog({ party, open, onOpenChange }: { party: Party; open: boolean; onOpenChange: (open: boolean) => void }) {
  const api = useApi();
  const [inviteUrl, setInviteUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [email, setEmail] = useState('');
  const [emailClientId, setEmailClientId] = useState(() => crypto.randomUUID());
  const emailStatus = useQuery({queryKey:['email-invites',party.id],queryFn:()=>api.emailInviteStatus(party.id),enabled:open});
  const emailSend = useMutation({mutationFn:()=>api.sendEmailInvite(party.id,email,emailClientId)});
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
      void QRCode.toDataURL(url, { width: 224, margin: 1, color: { dark: '#18181b', light: '#ffffff' } }).then(setQrData).catch(() => setQrData(''));
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
      setCopyError('Your browser blocked clipboard access. Select the link and copy it.');
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content invite-dialog">
          <Dialog.Close className="dialog-close icon-button" aria-label="Close"><X size={18} /></Dialog.Close>
          <Dialog.Title className="dialog-title">Invite to {party.name}</Dialog.Title>
          <Dialog.Description className="dialog-description">Anyone with the link can ask to join after signing in.</Dialog.Description>
          <form className="party-note-form" onSubmit={event=>{event.preventDefault();emailSend.mutate();}}>
            <label>Email invitation<input className="text-input" type="email" required value={email} onChange={event=>{setEmail(event.target.value);setEmailClientId(crypto.randomUUID());emailSend.reset();}} /></label>
            {emailStatus.data?.reason && <p role="status">{emailStatus.data.reason}</p>}
            {emailStatus.isError && <p role="alert">{errorMessage(emailStatus.error)}</p>}
            <button className="button button-secondary" type="submit" disabled={!emailStatus.data?.available || emailSend.isPending || emailSend.data?.status==='sent' || emailSend.data?.status==='unknown'}>{emailSend.isPending?'Sending…':'Send invitation'}</button>
            {emailSend.isError && <p role="alert">{errorMessage(emailSend.error)}</p>}
            {emailSend.data && <p role="status">{emailSend.data.status==='sent'?'Invitation accepted by SES for delivery.':emailSend.data.reason}</p>}
          </form>
          {inviteUrl ? (
            <div className="invite-result">
              {qrData ? <img className="invite-qr" src={qrData} alt={`QR code for the invitation to ${party.name}`} /> : <div className="invite-qr invite-qr-placeholder"><LoaderCircle className="spin" size={18} /></div>}
              <div className="copy-field"><input className="text-input" aria-label="Invite link" readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} /><button className="button button-primary" type="button" onClick={() => void copyLink()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy'}</button></div>
              {expiresAt && <p className="invite-expiry">Expires {formatDateTime(expiresAt)}</p>}
              {copyError && <p className="inline-error" role="alert">{copyError}</p>}
            </div>
          ) : (
            <div className="invite-start">
              <QrCode size={28} className="invite-start-icon" />
              {inviteMutation.isError && <p className="inline-error" role="alert">{errorMessage(inviteMutation.error, 'The invite link could not be created.')}</p>}
              <button className="button button-primary button-full" type="button" disabled={inviteMutation.isPending} onClick={() => inviteMutation.mutate()}>{inviteMutation.isPending ? <LoaderCircle className="spin" size={16} /> : <Link2 size={16} />} Create link and QR code</button>
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
  replyToId?: string;
}

function ChatPanel({ party, backdropId, members, currentUserId, localMessages, setLocalMessages, localRuns, setLocalRuns }: {
  party: Party;
  backdropId: BackdropId;
  members: Member[];
  currentUserId: string;
  localMessages: Message[];
  setLocalMessages: (update: (current: Message[]) => Message[]) => void;
  localRuns: AgentRun[];
  setLocalRuns: (update: (current: AgentRun[]) => AgentRun[]) => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [pendingAttempt, setPendingAttempt] = useState<PendingMessage | null>(null);
  const [failedAttempt, setFailedAttempt] = useState<PendingMessage | null>(null);
  const [sendError, setSendError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);
  const selectReply = useCallback((message: Message) => {setReplyTo(message);composeRef.current?.focus();}, []);
  const prependRef = useRef<{ height: number; top: number } | null>(null);
  const nearBottomRef = useRef(true);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [summonKey, setSummonKey] = useState(0);
  const [burst, setBurst] = useState<{ key: number; x: number; y: number } | null>(null);
  const composerWrapRef = useRef<HTMLFormElement>(null);
  const chatPanelRef = useRef<HTMLElement>(null);
  const composerBoxRef = useRef<HTMLDivElement>(null);
  const names = useMemo(() => mentionNames(members), [members]);
  const pattern = useMemo(() => mentionPattern(names), [names]);
  const markdown = useMemo(() => markdownComponentsFor(pattern), [pattern]);
  const mentionOptions = useMemo<MentionOption[]>(() => {
    if (!mention) return [];
    const query = mention.query.toLowerCase();
    const all: MentionOption[] = [VIBE_OPTION, ...members.filter((member) => member.userId !== currentUserId).map((member) => ({ id: member.userId, name: member.name, kind: 'member' as const }))];
    return all.filter((option) => !query || option.name.toLowerCase().split(/\s+/).some((part) => part.startsWith(query)) || option.name.toLowerCase().startsWith(query));
  }, [mention, members, currentUserId]);
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
  const { hash } = useLocation();
  const sourceId = /^#message-([A-Za-z0-9_-]{1,80})$/.exec(hash)?.[1];
  useEffect(() => {
    if (!sourceId || pagesQuery.isPending) return;
    const source = document.getElementById(`message-${sourceId}`);
    if (source) { source.scrollIntoView({ block: 'center' }); return; }
    if (pagesQuery.hasNextPage && !pagesQuery.isFetching && pages.length < 6) void pagesQuery.fetchNextPage();
  }, [sourceId, visibleMessages, pages.length, pagesQuery.isPending, pagesQuery.isFetching, pagesQuery.hasNextPage, pagesQuery.fetchNextPage]);


  const sendMutation = useMutation({
    mutationFn: (attempt: PendingMessage) => api.sendMessage(party.id, { text: attempt.text, clientId: attempt.clientId, replyToId: attempt.replyToId }),
    onSuccess: async (result: SendResult, attempt) => {
      setLocalMessages((current) => uniqueMessages([...current, result.message]));
      if (result.run) setLocalRuns((current) => mergeRuns(current, [result.run!]));
      setPendingAttempt(null);
      setFailedAttempt(null);
      setSendError('');
      setReplyTo(null);
      setDraft((current) => current.trim() === attempt.text ? '' : current);
      await queryClient.invalidateQueries({ queryKey: ['messages', party.id] });
    },
    onError: (error, attempt) => {
      setPendingAttempt(null);
      setFailedAttempt(attempt);
      setDraft(attempt.text);
      setSendError(errorMessage(error, 'Your message could not be sent.'));
    },
  });

  const activeRunCount = runs.filter((run) => run.status === 'queued' || run.status === 'thinking').length;

  useLayoutEffect(() => {
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
  }, [visibleMessages.length, pendingAttempt?.clientId, failedAttempt?.clientId, activeRunCount, pagesQuery.isPending]);

  useEffect(() => {
    if (!localMessages.length) return;
    const loadedIds = new Set(messages.map((message) => message.id));
    if (localMessages.some((message) => loadedIds.has(message.id))) {
      setLocalMessages((current) => current.filter((message) => !loadedIds.has(message.id)));
    }
  }, [localMessages, messages, setLocalMessages]);

  useLayoutEffect(() => {
    const element = composeRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`;
  }, [draft]);

  const hasVibeMention = /@vibe(?![\p{L}\p{N}_])/iu.test(draft);
  const hadVibeMention = useRef(false);
  useEffect(() => {
    if (hasVibeMention && !hadVibeMention.current) setSummonKey((key) => key + 1);
    hadVibeMention.current = hasVibeMention;
  }, [hasVibeMention]);

  useLayoutEffect(() => {
    if (summonKey === 0) return;
    const wrap = composerWrapRef.current;
    const chip = mirrorRef.current?.querySelector('.mention-vibe') ?? wrap?.querySelector('.mention-button');
    if (!wrap || !chip) return;
    const wrapRect = wrap.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    setBurst({ key: summonKey, x: chipRect.left + chipRect.width / 2 - wrapRect.left, y: chipRect.top + chipRect.height / 2 - wrapRect.top });
    const timer = window.setTimeout(() => setBurst((current) => current?.key === summonKey ? null : current), 1_400);
    return () => window.clearTimeout(timer);
  }, [summonKey]);

  const updateMention = (value: string, caret: number | null) => {
    const next = caret === null ? null : activeMentionQuery(value, caret);
    if (next && (!mention || mention.start !== next.start)) setMentionIndex(0);
    if (next?.start !== mention?.start || next?.query !== mention?.query) setMention(next);
  };

  const chooseMention = (option: MentionOption) => {
    const element = composeRef.current;
    if (!element || !mention) return;
    const caret = element.selectionStart ?? draft.length;
    const insert = `@${option.name} `;
    const nextDraft = `${draft.slice(0, mention.start)}${insert}${draft.slice(caret)}`;
    const nextCaret = mention.start + insert.length;
    setDraft(nextDraft);
    setMention(null);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const runAttempt = (attempt: PendingMessage) => {
    setSendError('');
    setPendingAttempt(attempt);
    nearBottomRef.current = true;
    sendMutation.mutate(attempt);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sendMutation.isPending || failedAttempt) return;
    runAttempt({ text, clientId: crypto.randomUUID(), createdAt: new Date().toISOString(), ...(replyTo ? {replyToId:replyTo.id} : {}) });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && mentionOptions.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setMentionIndex((index) => (index + step + mentionOptions.length) % mentionOptions.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        chooseMention(mentionOptions[Math.min(mentionIndex, mentionOptions.length - 1)]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMention(null);
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      composeRef.current?.form?.requestSubmit();
    }
  };

  const addMention = () => {
    setDraft((current) => /@vibe\b/i.test(current) ? current : `@Vibe ${current}`);
    setMention(null);
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

  const isEmpty = !pagesQuery.isPending && !pagesQuery.isError && visibleMessages.length === 0 && !pendingAttempt && !failedAttempt;
  const mentioning = hasVibeMention;

  return (
    <section className="chat-panel" ref={chatPanelRef} aria-label={`Conversation in ${party.name}`}>
      {!pagesQuery.isPending && <Suspense fallback={null}><MascotDock containerRef={chatPanelRef} composerRef={composerBoxRef} composerInputRef={composeRef} runs={runs} draft={draft} messages={visibleMessages} currentUserId={currentUserId} theme={backdropId} /></Suspense>}
      <div className="message-scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="message-column-wrap">
          {sourceId && !visibleMessages.some(message => message.id === sourceId) && pages.length >= 6 && <p className="run-note">This source is further back in the conversation. Load earlier messages to continue.</p>}
          {pagesQuery.isPending ? <MessageSkeleton /> : pagesQuery.isError ? (
            <ErrorState title="Messages didn’t load" message={errorMessage(pagesQuery.error)} onRetry={() => void pagesQuery.refetch()} />
          ) : isEmpty ? <EmptyConversation party={party} backdropId={backdropId} memberCount={members.length} onMention={addMention} /> : (
            <>
              {pagesQuery.hasNextPage && <div className="load-earlier-row"><button className="chip-button" type="button" disabled={pagesQuery.isFetchingNextPage} onClick={() => void loadEarlier()}>{pagesQuery.isFetchingNextPage && <LoaderCircle className="spin" size={14} />} Load earlier messages</button></div>}
              <div className="message-list" aria-live="polite">
                {visibleMessages.map((message, index) => {
                  const previous = visibleMessages[index - 1];
                  const grouped = Boolean(previous && previous.authorId === message.authorId && previous.role === message.role
                    && Date.parse(message.createdAt) - Date.parse(previous.createdAt) < 5 * 60_000 && !runsByTrigger.has(previous.id));
                  const run = runsByTrigger.get(message.id);
                  return (
                    <div key={message.id} className="message-group">
                      <MessageRow message={message} isSelf={message.authorId === currentUserId && message.role === 'user'} grouped={grouped} run={run} components={markdown} onReply={selectReply} />
                      {run && (run.status === 'queued' || run.status === 'thinking') && <ThinkingRow status={run.status} backdropId={backdropId} />}
                    </div>
                  );
                })}
                {pendingAttempt && <PendingMessageRow attempt={pendingAttempt} status="sending" pattern={pattern} />}
                {failedAttempt && <PendingMessageRow attempt={failedAttempt} status="failed" pattern={pattern} />}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="composer-dock">
        <form className="composer-wrap" ref={composerWrapRef} onSubmit={submit}>
          {replyTo && <div className="reply-preview"><span>Replying to {replyTo.authorName} · {replyTo.text.slice(0,100)}</span><button className="text-button" type="button" onClick={()=>setReplyTo(null)}>Cancel reply</button></div>}
          {burst && <ConfettiBurst key={burst.key} x={burst.x} y={burst.y} />}
          {failedAttempt && <div className="composer-error" role="alert"><AlertCircle size={15} /><span>{sendError}</span></div>}
          {mention && mentionOptions.length > 0 && (
            <div className="mention-menu" role="listbox" id="mention-menu" aria-label="Mention someone">
              {mentionOptions.map((option, index) => (
                <button
                  key={option.id}
                  id={`mention-option-${option.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === mentionIndex}
                  className={`mention-option${index === mentionIndex ? ' mention-option-active' : ''}${option.kind === 'vibe' ? ' mention-option-vibe' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setMentionIndex(index)}
                  onClick={() => chooseMention(option)}
                >
                  {option.kind === 'vibe' ? <VibeAvatar size={28} /> : <Avatar name={option.name} size="small" />}
                  <span className="mention-option-copy"><strong>{option.name}</strong><span>{option.kind === 'vibe' ? 'Ask for help in this chat' : 'Party member'}</span></span>
                </button>
              ))}
            </div>
          )}
          <div ref={composerBoxRef} className={`composer${failedAttempt ? ' composer-failed' : ''}${mentioning ? ' composer-summoned' : ''}`}>
            <div className="composer-field">
              <div className="composer-mirror" ref={mirrorRef} aria-hidden="true">{highlightMentions(draft, pattern, 'draft')}{'\u200b'}</div>
              <textarea
                ref={composeRef}
                className="composer-input"
                aria-label={`Message ${party.name}`}
                aria-autocomplete="list"
                aria-controls={mention && mentionOptions.length > 0 ? 'mention-menu' : undefined}
                aria-activedescendant={mention && mentionOptions[mentionIndex] ? `mention-option-${mentionOptions[mentionIndex].id}` : undefined}
                disabled={Boolean(failedAttempt) || sendMutation.isPending}
                maxLength={4000}
                onChange={(event) => { setDraft(event.target.value); updateMention(event.target.value, event.target.selectionStart); }}
                onSelect={(event) => updateMention(event.currentTarget.value, event.currentTarget.selectionStart)}
                onBlur={() => setMention(null)}
                onScroll={(event) => { if (mirrorRef.current) mirrorRef.current.scrollTop = event.currentTarget.scrollTop; }}
                onKeyDown={onKeyDown}
                placeholder={`Message ${party.name}. Type @ to mention someone`}
                rows={1}
                value={draft}
              />
            </div>
            <div className="composer-tools">
              <button className={`mention-button${mentioning ? ' mention-button-on' : ''}`} type="button" disabled={Boolean(failedAttempt)} onClick={addMention} aria-pressed={mentioning}><VibeMark size={16} /> Ask Vibe</button>
              <span className="composer-spacer" />
              {draft.length >= 3800 && <span className="composer-count">{draft.length}/4000</span>}
              {failedAttempt ? (
                <>
                  <button className="text-button" type="button" disabled={sendMutation.isPending} title="Editing creates a new send ID" onClick={() => { setFailedAttempt(null); setSendError(''); composeRef.current?.focus(); }}>Edit</button>
                  <button className="button button-primary button-small" type="button" disabled={sendMutation.isPending} onClick={() => runAttempt(failedAttempt)}><RefreshCw size={14} /> Retry</button>
                </>
              ) : (
                <button className="send-button" type="submit" aria-label="Send message" title="Send" disabled={!draft.trim() || sendMutation.isPending}><ArrowUp size={18} strokeWidth={2.4} /></button>
              )}
            </div>
          </div>
          <p className="composer-hint">Vibe only replies when someone mentions @Vibe.</p>
        </form>
      </div>
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
  return (
    <div className="message-skeleton-stack delayed-reveal" aria-label="Loading messages">
      <span className="skeleton message-skeleton" style={{ width: '46%' }} />
      <span className="skeleton message-skeleton message-skeleton-self" style={{ width: '32%' }} />
      <span className="skeleton message-skeleton" style={{ width: '58%', height: 64 }} />
    </div>
  );
}

function EmptyConversation({ party, backdropId, memberCount, onMention }: { party: Party; backdropId: BackdropId; memberCount: number; onMention: () => void }) {
  return (
    <div className="conversation-empty">
      <BackdropIllustration id={backdropId} />
      <h2>{party.name}</h2>
      <p>{party.goal}</p>
      <p className="conversation-empty-hint">{memberCount > 1 ? 'Say hi to the group to get things going.' : 'Invite people from the top right, or start planning with Vibe.'}</p>
      <button className="chip-button" type="button" onClick={onMention}><VibeMark size={16} /> Ask Vibe to get started</button>
    </div>
  );
}

function markdownComponentsFor(pattern: RegExp): Components {
  return {
    a: ({ href, children }) => {
      const isExternal = href?.startsWith('http://') || href?.startsWith('https://');
      return <a href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noopener noreferrer' : undefined}>{children}</a>;
    },
    table: ({ children }) => <div className="table-scroll"><table>{children}</table></div>,
    p: ({ children }) => <p>{withMentions(children, pattern)}</p>,
    li: ({ children }) => <li>{withMentions(children, pattern)}</li>,
    td: ({ children }) => <td>{withMentions(children, pattern)}</td>,
  };
}

function MessageRowView({ message, isSelf, grouped, run, components, onReply }: { message: Message; isSelf: boolean; grouped: boolean; run?: AgentRun; components: Components; onReply: (message: Message) => void }) {
  const isAssistant = message.role === 'assistant';
  const time = formatTime(message.createdAt);
  const kind = isAssistant ? 'msg-vibe' : isSelf ? 'msg-self' : 'msg-other';
  return (
    <article id={`message-${message.id}`} className={`msg ${kind}${grouped ? ' msg-grouped' : ''}`}>
      {!isSelf && <span className="msg-avatar">{grouped ? null : isAssistant ? <VibeAvatar size={30} /> : <Avatar name={message.authorName} size="small" />}</span>}
      <div className="msg-body">
        {!grouped && !isSelf && <div className="msg-meta"><strong>{isAssistant ? 'Vibe' : message.authorName}</strong><time dateTime={message.createdAt}>{time}</time></div>}
        {message.replyToId && <a className="reply-reference" href={`#message-${message.replyToId}`}>In reply to an earlier message</a>}
        <div className="msg-bubble" title={isSelf ? time : undefined}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{message.text}</ReactMarkdown>
        </div>
        <button className="text-button message-reply" type="button" onClick={()=>onReply(message)}>Reply</button>
        {message.citations?.length ? <details className="message-sources"><summary>Sources ({message.citations.length})</summary><ul>{message.citations.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">[{source.id}] {new URL(source.url).hostname}</a> · {new Date(source.retrievedAt).toLocaleString()}</li>)}</ul></details> : null}
        {[...new Set(message.researchWarnings ?? [])].map((warning,index) => <p className="run-note" role="status" key={index}>{warning}</p>)}
        {run?.status === 'failed' && <p className="run-note run-failed"><AlertCircle size={14} /><span>Vibe couldn’t answer{run.error ? `: ${run.error}` : '. Mention @Vibe again to retry.'}</span></p>}
        {run?.status === 'cancelled' && <p className="run-note">Vibe’s reply was cancelled.</p>}
      </div>
    </article>
  );
}

const MessageRow = memo(MessageRowView);

const thinkingWords = ['Thinking', 'Churning', 'Pondering', 'Mulling it over', 'Connecting the dots', 'Brewing ideas', 'Crunching', 'Noodling', 'Cooking something up', 'Weighing options', 'Piecing it together', 'Vibing'];
const themedWords: Record<BackdropId, string[]> = {
  travel: ['Mapping routes', 'Checking the map', 'Packing ideas'],
  study: ['Hitting the books', 'Taking notes', 'Studying up'],
  build: ['Compiling thoughts', 'Sketching it out', 'Debugging ideas'],
  food: ['Tasting options', 'Reading the menu', 'Simmering'],
  outdoors: ['Scouting trails', 'Pitching ideas', 'Checking the forecast'],
  celebrate: ['Setting the mood', 'Planning the fun', 'Tuning up'],
  chill: ['Catching up', 'Reading the room', 'Gathering thoughts'],
};

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function ThinkingRow({ status, backdropId }: { status: 'queued' | 'thinking'; backdropId: BackdropId }) {
  const words = useMemo(() => ['Thinking', ...shuffled([...thinkingWords.slice(1), ...themedWords[backdropId]])], [backdropId]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (status !== 'thinking') return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % words.length), 1_600);
    return () => window.clearInterval(timer);
  }, [status, words.length]);
  const word = status === 'queued' ? 'Warming up' : words[index];
  return (
    <div className="msg msg-vibe msg-thinking" role="status">
      <span className="msg-avatar"><VibeAvatar size={30} /></span>
      <div className="msg-body">
        <div className="thinking-pill">
          <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="sr-only">Vibe is working on a reply</span>
          <span className="thinking-word" key={word} aria-hidden="true">{word}…</span>
        </div>
      </div>
    </div>
  );
}

function PendingMessageRow({ attempt, status, pattern }: {
  attempt: PendingMessage;
  status: 'sending' | 'failed';
  pattern: RegExp;
}) {
  return (
    <article className={`msg msg-self msg-pending${status === 'failed' ? ' msg-pending-failed' : ''}`}>
      <div className="msg-body">
        <div className="msg-bubble"><p>{highlightMentions(attempt.text, pattern, 'pending')}</p></div>
        {status === 'failed' && <p className="run-note run-failed"><AlertCircle size={13} /> Not sent</p>}
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
