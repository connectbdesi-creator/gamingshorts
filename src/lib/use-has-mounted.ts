import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * True only after the client has hydrated. Use this instead of the
 * setState-in-effect "mounted" pattern when a component's first real
 * render depends on browser-only state (matchMedia, localStorage,
 * navigator capabilities, etc.) that would otherwise mismatch the
 * server-rendered markup.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
