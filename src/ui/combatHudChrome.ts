import Phaser from "phaser";

export type CombatHudChrome = {
  roots: Phaser.GameObjects.GameObject[];
  setVisible: (visible: boolean) => void;
};

/** Combat uses sprite buttons only — no decorative bottom panel chrome. */
export function createCombatHudChrome(
  _scene: Phaser.Scene,
  _depth = 45,
): CombatHudChrome {
  return {
    roots: [],
    setVisible: () => {},
  };
}