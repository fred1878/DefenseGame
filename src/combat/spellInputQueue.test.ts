import { describe, expect, it } from "vitest";
import { SpellInputQueue } from "./spellInputQueue";
import { spellById } from "../content/spells";

describe("SpellInputQueue", () => {
  it("replaces the queued spell when a new press arrives (newest wins)", () => {
    const q = new SpellInputQueue();
    q.enqueue("fire_bolt");
    expect(q.peek()).toBe("fire_bolt");
    q.enqueue("heal");
    expect(q.peek()).toBe("heal");
  });

  it("returns the queued spell when idle and still", () => {
    const q = new SpellInputQueue();
    q.enqueue("fire_bolt");
    const id = q.consumeIfReady(0, 0, spellById);
    expect(id).toBe("fire_bolt");
    expect(q.peek()).toBeNull();
  });

  it("discards stationary windup/channel spells when stick is moving", () => {
    const q = new SpellInputQueue();
    q.enqueue("heal");
    expect(q.consumeIfReady(1, 0, spellById)).toBeNull();
    expect(q.peek()).toBeNull();
  });

  it("still activates instant spells while moving", () => {
    const q = new SpellInputQueue();
    q.enqueue("fire_nova");
    expect(q.consumeIfReady(0.9, 0, spellById)).toBe("fire_nova");
  });

  it("models post-attack activation: queue during busy, consume after attack", () => {
    let attackBusy = true;
    const q = new SpellInputQueue();

    const onSpellPress = (spellId: string) => {
      if (attackBusy) {
        q.enqueue(spellId);
        return "queued" as const;
      }
      return "cast_now" as const;
    };

    expect(onSpellPress("fire_bolt")).toBe("queued");
    attackBusy = false;
    const afterAttack = q.consumeIfReady(0, 0, spellById);
    expect(afterAttack).toBe("fire_bolt");
  });
});