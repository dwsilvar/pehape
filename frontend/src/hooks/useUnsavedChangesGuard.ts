import { useEffect, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Guards against accidental navigation or page refresh when there are unsaved changes.
 *
 * - Registers a `beforeunload` listener to warn on browser refresh / tab close.
 * - Uses React Router's `useBlocker` to intercept in-app navigation and return
 *   a `blocker` object that the caller can render a confirmation dialog with.
 *
 * @param isDirty - When true, the guard is active.
 * @returns The blocker object from `useBlocker`. Check `blocker.state === 'blocked'`
 *          to know whether to show a confirmation dialog.
 *          Call `blocker.proceed()` to allow navigation, `blocker.reset()` to cancel it.
 */
export function useUnsavedChangesGuard(isDirty: boolean, restrictToPath?: string) {
  // ── 1. Browser refresh / tab close ────────────────────────────────────
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore the custom message, but the dialog still appears.
      e.returnValue = 'Tienes cambios sin guardar. ¿Seguro que quieres salir?';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // ── 2. In-app navigation (React Router) ──────────────────────────────
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) => {
        if (!isDirty) return false;
        if (currentLocation.pathname === nextLocation.pathname) return false;
        if (restrictToPath && currentLocation.pathname !== restrictToPath) return false;
        return true;
      },
      [isDirty, restrictToPath]
    )
  );

  return blocker;
}
