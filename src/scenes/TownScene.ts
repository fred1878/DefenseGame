import Phaser from "phaser";
import { GAME, type SaveGame } from "../config";
import { DataStore } from "../core/DataStore";
import {
  playerDamageMult,
  persistSave,
  resetSaveAndReload,
  wallHpBonusFromBuildings,
} from "../core/GameState";
import { showTouchInput } from "../debug/DebugState";
import { TouchInputDebugDraw } from "../debug/TouchInputDebugDraw";
import { configureSceneInput } from "../input/inputTuning";
import { createTouchButton } from "../ui/touchButton";

export class TownScene extends Phaser.Scene {
  private save!: SaveGame;
  private statusText!: Phaser.GameObjects.Text;
  private resetArmed = false;
  private resetButton!: ReturnType<typeof createTouchButton>;
  private touchDebug!: TouchInputDebugDraw;

  constructor() {
    super({ key: "Town" });
  }

  create(): void {
    configureSceneInput(this);
    this.save = this.registry.get("save") as SaveGame;
    const store = this.registry.get("dataStore") as DataStore;

    this.add
      .rectangle(0, 0, GAME.width, GAME.height, 0x1a1c24)
      .setOrigin(0);

    this.add
      .text(GAME.width / 2, 72, "Town — Day", {
        fontSize: "28px",
        color: "#f4f4f5",
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(GAME.width / 2, 140, "", {
        fontSize: "18px",
        color: "#a1a1aa",
        align: "center",
        wordWrap: { width: GAME.width - 48 },
      })
      .setOrigin(0.5, 0);

    this.refreshStatus(store);

    createTouchButton(
      this,
      58,
      44,
      "Debug",
      () => this.scene.launch("DebugMenu"),
      {
        width: 88,
        height: 36,
        depth: 200,
        fontSize: "14px",
        fillColor: 0x3f3f46,
        strokeColor: 0xa1a1aa,
      },
    );

    this.resetButton = createTouchButton(
      this,
      GAME.width - 70,
      44,
      "Reset save",
      () => this.onResetTap(),
      {
        width: 118,
        height: 36,
        depth: 200,
        fontSize: "14px",
        fillColor: 0x7f1d1d,
        strokeColor: 0xf87171,
      },
    );

    createTouchButton(this, GAME.width / 2, GAME.height - 120, "Start night", () => {
      this.scene.start("Defense");
    }, { width: 260, height: 48, depth: 200 });

    createTouchButton(this, GAME.width / 2, GAME.height - 210, "Upgrade wall", () => {
      this.tryUpgrade(store, "wall");
    }, { width: 260, height: 48, depth: 200 });

    createTouchButton(this, GAME.width / 2, GAME.height - 290, "Upgrade blacksmith", () => {
      this.tryUpgrade(store, "blacksmith");
    }, { width: 260, height: 48, depth: 200 });

    this.touchDebug = new TouchInputDebugDraw(this);
    this.events.on("shutdown", () => this.touchDebug.destroy());
  }

  update(_time: number, _delta: number): void {
    if (!showTouchInput(this.registry)) {
      this.touchDebug.clear();
      return;
    }
    this.touchDebug.draw({
      pointerUiBlocked: (pointer) => this.isPointerOverInteractive(pointer),
    });
  }

  private isPointerOverInteractive(pointer: Phaser.Input.Pointer): boolean {
    const hits = this.input.hitTestPointer(pointer);
    for (const hit of hits) {
      if (this.hasInteractiveInput(hit as Phaser.GameObjects.GameObject)) return true;
    }
    return false;
  }

  private hasInteractiveInput(obj: Phaser.GameObjects.GameObject): boolean {
    let node: Phaser.GameObjects.GameObject | null = obj;
    while (node) {
      if (node.input?.enabled) return true;
      const parent: Phaser.GameObjects.Container | null =
        (node as Phaser.GameObjects.GameObject & { parentContainer?: Phaser.GameObjects.Container })
          .parentContainer ?? null;
      node = parent;
    }
    return false;
  }

  private onResetTap(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.resetButton.setLabel("Confirm reset");
      this.time.delayedCall(4000, () => {
        this.resetArmed = false;
        this.resetButton.setLabel("Reset save");
      });
      return;
    }
    resetSaveAndReload();
  }

  private tryUpgrade(store: DataStore, id: string): void {
    const def = store.buildings[id];
    if (!def) return;
    const level = this.save.buildings[id] ?? 0;
    if (level >= def.maxLevel) return;
    const cost = def.costByLevel[level];
    if (cost === undefined || this.save.gold < cost) return;

    this.save.gold -= cost;
    this.save.buildings[id] = level + 1;
    if (def.effect === "wallHpMax") {
      const bonus = wallHpBonusFromBuildings(this.save.buildings);
      this.save.townWallHpMax = 100 + bonus;
      this.save.townWallHp = Math.min(this.save.townWallHp, this.save.townWallHpMax);
    }
    persistSave(this.save);
    this.registry.set("save", this.save);
    this.refreshStatus(store);
  }

  private refreshStatus(store: DataStore): void {
    const wall = this.save.buildings.wall ?? 0;
    const smith = this.save.buildings.blacksmith ?? 0;
    const dmg = playerDamageMult(this.save.buildings).toFixed(2);
    const wallDef = store.buildings.wall;
    const wallCost =
      wall < (wallDef?.maxLevel ?? 0)
        ? wallDef?.costByLevel[wall]
        : undefined;
    this.statusText.setText(
      [
        `Night ${this.save.night} · Gold ${this.save.gold}`,
        `Wall L${wall} (HP ${this.save.townWallHp}/${this.save.townWallHpMax})${wallCost !== undefined ? ` — next ${wallCost}g` : ""}`,
        `Blacksmith L${smith} (damage x${dmg})`,
        "Reset save: fresh start + latest build",
      ].join("\n"),
    );
  }
}