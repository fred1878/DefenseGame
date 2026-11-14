import Phaser from "phaser";
import { GAME, type SaveGame } from "../config";
import { DataStore } from "../core/DataStore";
import {
  playerDamageMult,
  persistSave,
  wallHpBonusFromBuildings,
} from "../core/GameState";

export class TownScene extends Phaser.Scene {
  private save!: SaveGame;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "Town" });
  }

  create(): void {
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

    const startBtn = makeButton(this, GAME.width / 2, GAME.height - 120, "Start night", () => {
      this.scene.start("Defense");
    });

    const upgradeWall = makeButton(this, GAME.width / 2, GAME.height - 210, "Upgrade wall", () => {
      this.tryUpgrade(store, "wall");
    });

    const upgradeSmith = makeButton(this, GAME.width / 2, GAME.height - 290, "Upgrade blacksmith", () => {
      this.tryUpgrade(store, "blacksmith");
    });

    startBtn.setDepth(20);
    upgradeWall.setDepth(20);
    upgradeSmith.setDepth(20);
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
      ].join("\n"),
    );
  }
}

function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(0, 0, 260, 48, 0x3b82f6, 1).setStrokeStyle(2, 0x60a5fa);
  const text = scene.add.text(0, 0, label, { fontSize: "20px" }).setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, text]);
  container.setSize(260, 48);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-130, -24, 260, 48),
    Phaser.Geom.Rectangle.Contains,
  );
  container.on("pointerup", onClick);
  return container;
}