import Phaser from "phaser";

export type GameEvents = {
  "night-complete": { result: import("./saveTypes").NightResult };
};

export class EventBus extends Phaser.Events.EventEmitter {
  emitNightComplete(result: GameEvents["night-complete"]["result"]): void {
    this.emit("night-complete", { result });
  }
}