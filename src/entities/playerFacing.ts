import Phaser from "phaser";

export type PlayerFacing4 = "south" | "east" | "north" | "west";

const TEXTURE_BY_FACING: Record<PlayerFacing4, string> = {
  south: "player_south",
  east: "player_east",
  north: "player_north",
  west: "player_west",
};

/** Maps movement/aim angle (radians) to one of four idle facings. */
export function facing4FromAngle(rad: number): PlayerFacing4 {
  const deg = Phaser.Math.RadToDeg(rad);
  const n = ((deg % 360) + 360) % 360;
  if (n >= 315 || n < 45) return "east";
  if (n >= 45 && n < 135) return "south";
  if (n >= 135 && n < 225) return "west";
  return "north";
}

export function playerTextureForFacing(facing: PlayerFacing4): string {
  return TEXTURE_BY_FACING[facing];
}