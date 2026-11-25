/** Tiny event emitter + pointer fakes for UI input tests (Phaser stub has none). */
type Handler = (...args: never[]) => void;

export class FakeEmitter {
  private readonly handlers = new Map<string, Set<Handler>>();

  on(event: string, fn: Handler): this {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn);
    return this;
  }

  once(event: string, fn: Handler): this {
    const wrapped = ((...args: never[]) => {
      this.off(event, wrapped);
      fn(...args);
    }) as Handler;
    return this.on(event, wrapped);
  }

  off(event: string, fn: Handler): this {
    this.handlers.get(event)?.delete(fn);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const fn of [...(this.handlers.get(event) ?? [])]) {
      (fn as (...a: unknown[]) => void)(...args);
    }
  }

  listenerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}

export type FakePointer = { id: number; x: number; y: number; isDown: boolean };

export function fakePointer(
  x: number,
  y: number,
  id = 1,
  isDown = true,
): FakePointer {
  return { id, x, y, isDown };
}

/** Minimal event data for Phaser pointer handlers that call stopPropagation(). */
export function fakeEventData(): { stopPropagation: () => void } {
  return { stopPropagation: () => {} };
}
