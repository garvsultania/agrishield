'use client';

import * as React from 'react';

export type ShortcutHandler = (event: KeyboardEvent) => void;

/**
 * Register a window-level keyboard shortcut. Keys are matched against
 * event.key. Ignores typing inside editable fields.
 */
export function useKeyboardShortcut(key: string, handler: ShortcutHandler, enabled = true): void {
  const handlerRef = React.useRef(handler);
  handlerRef.current = handler;

  React.useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === key) handlerRef.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, enabled]);
}

/**
 * Two-key "goto" sequence. Example: press `g`, then `m` to navigate.
 * Fires when the second key is pressed within `windowMs` of the first.
 */
export function useLeaderSequence(
  leader: string,
  onSecond: (key: string, event: KeyboardEvent) => void,
  windowMs = 1200
): void {
  const armedUntilRef = React.useRef(0);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const now = Date.now();
      if (e.key === leader && !e.metaKey && !e.ctrlKey && !e.altKey) {
        armedUntilRef.current = now + windowMs;
        return;
      }
      if (now < armedUntilRef.current) {
        armedUntilRef.current = 0;
        onSecond(e.key, e);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leader, onSecond, windowMs]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
