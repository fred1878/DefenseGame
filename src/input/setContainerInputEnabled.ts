/** Enable or disable Phaser pointer input on a container (preserves prior hit area). */
export function setContainerInputEnabled(
  container: Phaser.GameObjects.Container,
  enabled: boolean,
): void {
  if (enabled) container.setInteractive();
  else container.disableInteractive();
}
