import { supabase } from "../lib/supabase";
import { navigate } from "../router";

export type Role = "seller" | "admin";

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  role: Role;
  created_at: string;
}

interface AuthState {
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  loading: boolean;
}

const state: AuthState = { userId: null, email: null, profile: null, loading: true };
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

/** Subscribe to auth/profile changes (sign in, sign out, initial session load). */
export function onAuthChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) {
    console.error(error);
    return null;
  }
  return data as Profile;
}

async function refreshState(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (session?.user) {
    state.userId = session.user.id;
    state.email = session.user.email ?? null;
    state.profile = await loadProfile(session.user.id);
  } else {
    state.userId = null;
    state.email = null;
    state.profile = null;
  }
  state.loading = false;
  notify();
}

supabase.auth.onAuthStateChange(() => {
  void refreshState();
});

const initialLoad = refreshState();

/** True once the initial session check (and profile fetch, if any) has completed. */
export function isAuthReady(): boolean {
  return !state.loading;
}

export function waitForAuth(): Promise<void> {
  return initialLoad;
}

export function getCurrentProfile(): Profile | null {
  return state.profile;
}

export function getCurrentUserId(): string | null {
  return state.userId;
}

export function getCurrentEmail(): string | null {
  return state.email;
}

export function isAuthenticated(): boolean {
  return state.userId !== null;
}

export function isAdmin(): boolean {
  return state.profile?.role === "admin";
}

export interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  country: string;
}

export async function signUp(params: SignUpParams): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: { full_name: params.fullName, phone: params.phone, country: params.country }
    }
  });
  if (error) return { error: error.message };
  await refreshState();
  return { error: null };
}

export async function signIn(email: string, password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  await refreshState();
  return { error: null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await refreshState();
  navigate("#/");
}

/** Call at the top of a protected page's render function. Returns false and redirects if the guard fails. */
export function requireAuth(main: HTMLElement): boolean {
  if (isAuthenticated()) return true;
  main.innerHTML = "";
  navigate("#/login");
  return false;
}

export function requireAdmin(main: HTMLElement): boolean {
  if (isAuthenticated() && isAdmin()) return true;
  main.innerHTML = "";
  navigate(isAuthenticated() ? "#/account" : "#/login");
  return false;
}
