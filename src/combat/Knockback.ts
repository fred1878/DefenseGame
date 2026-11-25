import type Phaser from "phaser";
import { knockbackVelocityCapMult } from "../entities/entityPhysics";

export function applyKnockbackFrom(
  sprite: Phaser.Physics.Arcade.Sprite,
  fromX: number,
  fromY: number,
  strength: number,
): void {
  const dx = sprite.x - fromX;
  const dy = sprite.y - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const body = sprite.body as Phaser.Physics.Arcade.Body | null;
  if (!body) return;
  body.velocity.x += nx * strength;
  body.velocity.y += ny * strength;
  const maxV = strength * knockbackVelocityCapMult();
  const vlen = Math.hypot(body.velocity.x, body.velocity.y);
  if (vlen > maxV) {
    body.velocity.x = (body.velocity.x / vlen) * maxV;
    body.velocity.y = (body.velocity.y / vlen) * maxV;
  }
}