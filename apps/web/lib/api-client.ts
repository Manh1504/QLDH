const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010/api';

function token(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('azalas_access');
}

export async function api(path: string, init?: RequestInit) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...((init?.headers as any) || {}) };
  const t = token();
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (res.status === 401 && typeof window !== 'undefined' && !path.includes('/auth/')) {
    localStorage.removeItem('azalas_access');
    window.location.href = '/login';
    throw new Error('Hết phiên, đăng nhập lại');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function login(username: string, password: string) {
  const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  localStorage.setItem('azalas_access', r.access);
  localStorage.setItem('azalas_refresh', r.refresh);
  localStorage.setItem('azalas_user', JSON.stringify(r.user));
  return r.user;
}

export function logout() {
  localStorage.removeItem('azalas_access');
  localStorage.removeItem('azalas_refresh');
  localStorage.removeItem('azalas_user');
  window.location.href = '/login';
}

export function currentUser(): any | null {
  try { return JSON.parse(localStorage.getItem('azalas_user') || 'null'); } catch { return null; }
}
