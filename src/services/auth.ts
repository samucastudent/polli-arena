import { CONFIG } from '../config';

export interface UserProfile {
  sub?: string;
  preferred_username?: string;
  name?: string;
  picture?: string;
  email?: string;
}

export interface UserBalance {
  questPollen: number;
  paidPollen: number;
  total: number;
}

class AuthService {
  private token: string | null = null;
  private user: UserProfile | null = null;
  private balance: UserBalance | null = null;
  private listeners: Array<() => void> = [];

  constructor() {
    this.initFromStorage();
  }

  // Subscribe to auth state changes
  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  private initFromStorage() {
    // Try to load cached token
    const storedToken = sessionStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    if (storedToken) {
      this.token = storedToken;
    }

    const storedUser = sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER_INFO);
    if (storedUser) {
      try {
        this.user = JSON.parse(storedUser);
      } catch {
        this.user = null;
      }
    }

    const storedBalance = sessionStorage.getItem(CONFIG.STORAGE_KEYS.BALANCE);
    if (storedBalance) {
      try {
        this.balance = JSON.parse(storedBalance);
      } catch {
        this.balance = null;
      }
    }
  }

  public isAuthenticated(): boolean {
    return !!this.token;
  }

  public getToken(): string | null {
    return this.token;
  }

  public getUser(): UserProfile | null {
    return this.user;
  }

  public getBalance(): UserBalance | null {
    return this.balance;
  }

  public getClientId(): string {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.APP_KEY) || CONFIG.DEFAULT_CLIENT_ID;
  }

  public setClientId(clientId: string) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.APP_KEY, clientId);
  }

  // Generate a cryptographically random PKCE verifier
  private generateRandomString(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const values = new Uint8Array(length);
    window.crypto.getRandomValues(values);
    return Array.from(values, x => charset[x % charset.length]).join('');
  }

  // Base64URL encode buffer
  private base64UrlEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // SHA256 of verifier
  private async sha256(plain: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
  }

  // Initiate login with Pollinations (BYOP)
  public async login() {
    const clientId = this.getClientId();
    // Use current URL origin + pathname as exact redirect URI
    const redirectUri = window.location.origin + window.location.pathname;

    const verifier = this.generateRandomString(64);
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.PKCE_VERIFIER, verifier);

    const challengeBuffer = await this.sha256(verifier);
    const codeChallenge = this.base64UrlEncode(challengeBuffer);
    const state = this.generateRandomString(32);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'profile usage',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const authUrl = `${CONFIG.AUTH_BASE}/authorize?${params.toString()}`;
    window.location.href = authUrl;
  }

  // Handle callback on return
  public async handleCallback(): Promise<boolean> {
    const url = new URL(window.location.href);

    // 1. Check for legacy fragment flow fallback: #api_key=sk_...
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const apiKey = hashParams.get('api_key');
      if (apiKey) {
        this.token = apiKey;
        sessionStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, apiKey);
        // Clean hash
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        await this.fetchUserInfo();
        this.notify();
        return true;
      }
    }

    // 2. Check for OAuth PKCE Code: ?code=...
    const code = url.searchParams.get('code');
    if (!code) {
      return false;
    }

    const verifier = sessionStorage.getItem(CONFIG.STORAGE_KEYS.PKCE_VERIFIER);
    const clientId = this.getClientId();
    const redirectUri = window.location.origin + window.location.pathname;

    try {
      const response = await fetch(`${CONFIG.AUTH_BASE}/api/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: clientId,
          redirect_uri: redirectUri,
          code_verifier: verifier || ''
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error('Token exchange error:', err);
        return false;
      }

      const data = await response.json();
      if (data.access_token) {
        this.token = data.access_token;
        sessionStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, data.access_token);
        sessionStorage.removeItem(CONFIG.STORAGE_KEYS.PKCE_VERIFIER);

        // Remove OAuth query parameters cleanly from browser URL
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        url.searchParams.delete('session_state');
        window.history.replaceState(null, '', url.pathname + (url.search ? '?' + url.searchParams.toString() : ''));

        await this.fetchUserInfo();
        this.notify();
        return true;
      }
    } catch (e) {
      console.error('Failed to handle OAuth callback:', e);
    }
    return false;
  }

  // Fetch logged in user profile from Pollinations
  public async fetchUserInfo(): Promise<UserProfile | null> {
    if (!this.token) return null;

    try {
      const response = await fetch(`${CONFIG.AUTH_BASE}/api/oauth/userinfo`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (response.ok) {
        const user = await response.json();
        this.user = user;
        sessionStorage.setItem(CONFIG.STORAGE_KEYS.USER_INFO, JSON.stringify(user));
        this.notify();
        return user;
      }
    } catch (e) {
      console.warn('Could not fetch userinfo:', e);
    }
    return null;
  }

  // Update user balance estimation or live headers
  public updateBalance(quest: number, paid: number) {
    this.balance = {
      questPollen: quest,
      paidPollen: paid,
      total: quest + paid
    };
    sessionStorage.setItem(CONFIG.STORAGE_KEYS.BALANCE, JSON.stringify(this.balance));
    this.notify();
  }

  // Logout & revoke session locally
  public logout() {
    this.token = null;
    this.user = null;
    this.balance = null;
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.USER_INFO);
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.BALANCE);
    sessionStorage.removeItem(CONFIG.STORAGE_KEYS.PKCE_VERIFIER);
    this.notify();
  }
}

export const auth = new AuthService();
