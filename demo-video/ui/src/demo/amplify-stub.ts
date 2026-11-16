/* Stand-ins for the aws-amplify modules the UI imports. Demo only: no network, a fixed user. */
export const DEMO_USER = { userId: 'u-maya', username: 'maya' };

export const Amplify = { configure: () => undefined };

export async function getCurrentUser() { return DEMO_USER; }
export async function signOut() { /* demo */ }
export async function fetchAuthSession() { return { tokens: { idToken: { toString: () => 'demo-token' } } }; }
export async function signIn() { throw new Error('Demo mode'); }
export async function signUp() { throw new Error('Demo mode'); }
export async function confirmSignUp() { throw new Error('Demo mode'); }
export async function resendSignUpCode() { throw new Error('Demo mode'); }

export const Hub = { listen: () => () => undefined };

type Listener = () => void;
const listeners = new Set<Listener>();
/** Called by the mock server whenever data changes, like an AppSync Events refresh. */
export function emitPartyEvent() { listeners.forEach((listener) => listener()); }

export const events = {
  async connect() {
    let mine: Listener | null = null;
    return {
      subscribe(handlers: { next: (value: unknown) => void }) {
        mine = () => handlers.next({ type: 'refresh' });
        listeners.add(mine);
        return { ready: Promise.resolve(), unsubscribe: () => { if (mine) listeners.delete(mine); } };
      },
      close() { if (mine) listeners.delete(mine); },
    };
  },
};
