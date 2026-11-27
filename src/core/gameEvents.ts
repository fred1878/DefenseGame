/**
 * Tiny synchronous event bus for "something happened" notifications that
 * leaf layers (E2E hooks, telemetry) observe. Domain and FX code emit; they
 * never import the observers. Emitting with no listeners is a map lookup.
 */
export type GameEventMap = {
  /** A player melee swipe sprite was spawned. */
  playerMeleeFx: Record<string, never>;
  /** An enemy melee swipe was spawned, with the pose it was drawn at. */
  enemyMeleeFx: {
    enemyDefId: string;
    facingRad: number;
    rotation: number;
    flipX: boolean;
  };
};

type GameEventName = keyof GameEventMap;
type Listener<K extends GameEventName> = (payload: GameEventMap[K]) => void;

const listeners = new Map<GameEventName, Set<Listener<never>>>();

export function onGameEvent<K extends GameEventName>(
  name: K,
  fn: Listener<K>,
): () => void {
  let set = listeners.get(name);
  if (!set) {
    set = new Set();
    listeners.set(name, set);
  }
  set.add(fn as Listener<never>);
  return () => {
    set.delete(fn as Listener<never>);
  };
}

/** True when someone listens, so emitters can skip building a payload. */
export function hasGameEventListeners(name: GameEventName): boolean {
  return (listeners.get(name)?.size ?? 0) > 0;
}

export function emitGameEvent<K extends GameEventName>(
  name: K,
  payload: GameEventMap[K],
): void {
  const set = listeners.get(name);
  if (!set) return;
  for (const fn of set) (fn as Listener<K>)(payload);
}
