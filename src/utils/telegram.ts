export interface TelegramUserInfo {
  id?: number;
  firstName: string;
  lastName: string;
  fullName: string;
  username: string;
  isTelegramEnv: boolean;
}

export interface TelegramWebAppThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
}

export interface TelegramWebAppInstance {
  initData?: string;
  initDataUnsafe?: {
    user?: {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    start_param?: string;
  };
  version?: string;
  platform?: string;
  colorScheme?: 'light' | 'dark';
  themeParams?: TelegramWebAppThemeParams;
  isExpanded?: boolean;
  viewportHeight?: number;
  viewportStableHeight?: number;
  safeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number };
  contentSafeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number };
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred?: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged?: () => void;
  };
  isVersionAtLeast?: (version: string) => boolean;
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
  sendData?: (data: string) => void;
  openTelegramLink?: (url: string) => void;
  openLink?: (url: string) => void;
  showAlert?: (message: string, callback?: () => void) => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  enableClosingConfirmation?: () => void;
  onEvent?: (eventType: string, eventHandler: () => void) => void;
  offEvent?: (eventType: string, eventHandler: () => void) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebAppInstance;
    };
  }
}

export function getTelegramWebApp(): TelegramWebAppInstance | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

function isRealTelegramSession(tg: TelegramWebAppInstance | null): boolean {
  if (!tg) return false;
  return Boolean(
    (tg.initData && tg.initData.length > 0) ||
      tg.initDataUnsafe?.user?.id ||
      (tg.platform && tg.platform !== 'unknown'),
  );
}

export function getTelegramUser(): TelegramUserInfo {
  const tg = getTelegramWebApp();
  const user = tg?.initDataUnsafe?.user;
  const firstName = user?.first_name?.trim() ?? '';
  const lastName = user?.last_name?.trim() ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const username = user?.username?.trim() ?? '';
  return {
    id: user?.id,
    firstName,
    lastName,
    fullName,
    username,
    isTelegramEnv: isRealTelegramSession(tg),
  };
}

export function applyTelegramThemeAndViewport(): () => void {
  const tg = getTelegramWebApp();
  const root = document.documentElement;
  const inTelegram = isRealTelegramSession(tg);

  const sync = () => {
    root.classList.remove('dark');
    if (inTelegram) {
      const tp = tg?.themeParams;
      if (tp?.button_color) root.style.setProperty('--tg-theme-button-color', tp.button_color);
      if (tp?.button_text_color) {
        root.style.setProperty('--tg-theme-button-text-color', tp.button_text_color);
      }
    }

    const stableH = tg?.viewportStableHeight;
    if (inTelegram && stableH && stableH > 200) {
      root.style.setProperty('--tg-viewport-stable-height', `${stableH}px`);
    } else {
      root.style.setProperty('--tg-viewport-stable-height', '100dvh');
    }

    const safeBottom = tg?.safeAreaInset?.bottom ?? 0;
    const contentBottom = tg?.contentSafeAreaInset?.bottom ?? 0;
    const totalBottom = Math.max(safeBottom, contentBottom);
    root.style.setProperty(
      '--tg-safe-bottom',
      totalBottom > 0 ? `${totalBottom}px` : 'env(safe-area-inset-bottom, 0px)',
    );
  };

  try {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();

    if (inTelegram && tg?.isVersionAtLeast?.('6.2')) {
      window.Telegram?.WebApp?.enableClosingConfirmation?.();
    }
    if (inTelegram && tg?.isVersionAtLeast?.('6.1')) {
      window.Telegram?.WebApp?.setHeaderColor?.('#FAF8F5');
      window.Telegram?.WebApp?.setBackgroundColor?.('#FAF8F5');
    }
  } catch {
    // Safe no-op outside Telegram WebView
  }

  sync();

  try {
    tg?.onEvent?.('themeChanged', sync);
    tg?.onEvent?.('viewportChanged', sync);
    if (inTelegram) {
      tg?.onEvent?.('safeAreaChanged', sync);
      tg?.onEvent?.('contentSafeAreaChanged', sync);
    }
  } catch {
    // ignore
  }

  return () => {
    try {
      tg?.offEvent?.('themeChanged', sync);
      tg?.offEvent?.('viewportChanged', sync);
      if (inTelegram) {
        tg?.offEvent?.('safeAreaChanged', sync);
        tg?.offEvent?.('contentSafeAreaChanged', sync);
      }
    } catch {
      // ignore
    }
  };
}

let lastHapticAt = 0;

export function tgHapticImpact(
  style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light',
  throttleMs = 0,
): void {
  const now = Date.now();
  if (throttleMs > 0 && now - lastHapticAt < throttleMs) return;
  lastHapticAt = now;
  try {
    const tg = window.Telegram?.WebApp;
    if (!tg || !isRealTelegramSession(tg)) return;
    if (tg.isVersionAtLeast && !tg.isVersionAtLeast('6.1')) return;
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style);
  } catch {
    // No-op outside Telegram
  }
}

export function tgHapticNotification(type: 'error' | 'success' | 'warning'): void {
  try {
    const tg = window.Telegram?.WebApp;
    if (!tg || !isRealTelegramSession(tg)) return;
    if (tg.isVersionAtLeast && !tg.isVersionAtLeast('6.1')) return;
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(type);
  } catch {
    // No-op outside Telegram
  }
}

export function tgHapticSelection(): void {
  try {
    const tg = window.Telegram?.WebApp;
    if (!tg || !isRealTelegramSession(tg)) return;
    if (tg.isVersionAtLeast && !tg.isVersionAtLeast('6.1')) return;
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  } catch {
    // No-op outside Telegram
  }
}

export function shareViaTelegramLink(shareText: string, shareUrl?: string): 'telegram' | 'copied' {
  const tg = getTelegramWebApp();
  const targetUrl =
    shareUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://t.me');
  const encodedUrl = encodeURIComponent(targetUrl);
  const encodedText = encodeURIComponent(shareText);
  const tgShareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;

  if (isRealTelegramSession(tg) && typeof tg?.openTelegramLink === 'function') {
    try {
      window.Telegram?.WebApp?.openTelegramLink?.(tgShareUrl);
      tgHapticImpact('light');
      return 'telegram';
    } catch {
      // Fallback below
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(shareText).catch(() => {});
  }
  return 'copied';
}

export function sendOrderViaTelegram(
  payload: Record<string, unknown>,
  fallbackMessageText: string,
): 'sendData' | 'telegramShare' | 'copied' {
  const tg = getTelegramWebApp();
  if (isRealTelegramSession(tg) && typeof tg?.sendData === 'function' && tg.initData) {
    try {
      const serialized = JSON.stringify(payload);
      if (serialized.length <= 4096) {
        window.Telegram?.WebApp?.sendData?.(serialized);
        tgHapticNotification('success');
        return 'sendData';
      }
    } catch {
      // Fall through to share fallback
    }
  }

  const res = shareViaTelegramLink(fallbackMessageText);
  return res === 'telegram' ? 'telegramShare' : 'copied';
}
