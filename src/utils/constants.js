export const C = {
  PITCH_W: 1250, // Expanded horizontally by ~20%
  PITCH_H: 650,
  GOAL_W: 130,
  GOAL_Y: 260,
  BALL_R: 5.5,
  PLAYER_R: 10.5,
  FRICTION: 0.95, // Increased friction so ball stops sooner
  MAX_SPEED: 2.86, // Slightly slower players
  MAX_BALL_SPEED: 15.6,
  GRAVITY: 0.325,  // Z-axis gravity
  BOUNCE: 0.5,    // Z-axis bounce retention
  PENALTY_SPOT: 125,
  PENALTY_BOX_W: 171,
  PENALTY_BOX_H: 286,
  SIX_YARD_W: 62,
  SIX_YARD_H: 169,
  CORNER_ARC_R: 20,
  CENTER_CIRCLE_R: 85,
  TACKLE_RANGE: 26,
  PICKUP_RANGE: 19.5,
  STAMINA_DRAIN: 0.0018,
  STAMINA_SPRINT_MULT: 3,
};
export const REFEREE_NAMES = [
  'M. Oliver', 'A. Taylor', 'C. Pawson', 'P. Tierney', 'D. Coote',
  'S. Attwell', 'R. Jones', 'M. Dean', 'A. Marriner', 'J. Moss'
];

export function worldToScreen(x, y, z = 0) {
  let cx = 1150 / 2;
  
  let depth = (C.PITCH_H - y) * 0.5 + 1000;
  
  // Apply a 0.82 zoom factor so the whole pitch fits nicely inside the canvas
  let scale = (1000 / depth) * 0.82;
  
  let screenX = cx + (x - C.PITCH_W / 2) * scale;
  let screenY = -1430 + (2475 - z * 1.5) * scale;
  
  return { x: screenX, y: screenY, scale: scale };
}
