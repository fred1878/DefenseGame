import { describe, expect, it } from "vitest";
import { SpellInputQueue } from "./spellInputQueue";
import { spellById } from "../content/spells";

function peekSpellId(q: SpellInputQueue): string | null {
  const item = q.peek();
  return item?.kind === "spell" ? item.spellId : null;
}

describe("SpellInputQueue", () => {
  it("replaces the queued spell when a new press arrives (newest wins)", () => {
    const q = new SpellInputQueue();
    q.enqueue("fire_bolt");
    expect(peekSpellId(q)).toBe("fire_bolt");
    q.enqueue("heal");
    expect(peekSpellId(q)).toBe("heal");
  });

  it("replaces a queued spell when manual ATK is pressed (newest wins)", () => {
    const q = new SpellInputQueue();
    q.enqueue("fire_bolt");
    q.enqueueManualAttack();
    expect(q.peek()).toEqual({ kind: "manual_attack" });
    q.enqueue("heal");
    expect(peekSpellId(q)).toBe("heal");
  });

  it("replaces manual ATK when a newer spell press arrives", () => {
    const q = new SpellInputQueue();
    q.enqueueManualAttack();
    q.enqueue("fire_nova");
    expect(peekSpellId(q)).toBe("fire_nova");
  });

  it("returns the queued spell when idle and still", () => {
    const q = new SpellInputQueue();
    q.enqueue("fire_bolt");
    const item = q.consumeIfReady(0, 0, spellById);
    expect(item).toEqual({ kind: "spell", spellId: "fire_bolt" });
    expect(q.peek()).toBeNull();
  });

  it("returns manual ATK when idle without spell lookup", () => {
    const q = new SpellInputQueue();
    q.enqueueManualAttack();
    expect(q.consumeIfReady(0, 0, () => undefined)).toEqual({
      kind: "manual_attack",
    });
    expect(q.peek()).toBeNull();
  });

  it("consumes stationary windup/channel spells while the stick is active", () => {
    const q = new SpellInputQueue();
    q.enqueue("heal");
    expect(q.consumeIfReady(1, 0, spellById)).toEqual({
      kind: "spell",
      spellId: "heal",
    });
    expect(q.peek()).toBeNull();
  });

  it("still activates instant spells while moving", () => {
    const q = new SpellInputQueue();
    q.enqueue("fire_nova");
    expect(q.consumeIfReady(0.9, 0, spellById)).toEqual({
      kind: "spell",
      spellId: "fire_nova",
    });
  });

  it("models post-channel activation: queue during cast, consume after channel", () => {
    let castingBusy = true;
    const q = new SpellInputQueue();

    const onSpellPress = (spellId: string) => {
      if (castingBusy) {
        q.enqueue(spellId);
        return "queued" as const;
      }
      return "cast_now" as const;
    };

    expect(onSpellPress("fire_nova")).toBe("queued");
    castingBusy = false;
    expect(q.consumeIfReady(0, 0, spellById)).toEqual({
      kind: "spell",
      spellId: "fire_nova",
    });
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
    expect(afterAttack).toEqual({ kind: "spell", spellId: "fire_bolt" });
  });

  it("models manual ATK queue during busy attack FSM", () => {
    let attackBusy = true;
    const q = new SpellInputQueue();

    const onManualAtk = () => {
      if (attackBusy) {
        q.enqueueManualAttack();
        return "queued" as const;
      }
      return "attack_now" as const;
    };

    expect(onManualAtk()).toBe("queued");
    attackBusy = false;
    expect(q.consumeIfReady(0, 0, spellById)).toEqual({
      kind: "manual_attack",
    });
  });
});

describe("SpellInputQueue.clear", () => {
  it("drops a queued spell", () => {
    const q = new SpellInputQueue();
    q.enqueue("fire_bolt");
    q.clear();
    expect(q.peek()).toBeNull();
  });
});

describe("SpellInputQueue leftover branches", () => {
  it("consumes nothing when empty or the spell is unknown", () => {
    const q = new SpellInputQueue();
    expect(q.consumeIfReady(0, 0, spellById)).toBeNull();
    q.enqueue("missing_spell" as never);
    expect(q.consumeIfReady(0, 0, spellById)).toBeNull();
    expect(q.peek()).toBeNull();
  });
});
