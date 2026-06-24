import { C } from './constants.js';

export function getPenaltyBox(teamDefending) {
  let hh = C.PENALTY_BOX_H / 2;
  if (teamDefending === 0) {
    return { x1: 0, y1: C.PITCH_H / 2 - hh, x2: C.PENALTY_BOX_W, y2: C.PITCH_H / 2 + hh };
  }
  return { x1: C.PITCH_W - C.PENALTY_BOX_W, y1: C.PITCH_H / 2 - hh, x2: C.PITCH_W, y2: C.PITCH_H / 2 + hh };
}

export function isInPenaltyBox(pos, teamDefending) {
  let b = getPenaltyBox(teamDefending);
  return pos.x >= b.x1 && pos.x <= b.x2 && pos.y >= b.y1 && pos.y <= b.y2;
}

export function logEvent(msg, type = 'normal') {
  const logDiv = document.getElementById('match-log');
  if (!logDiv) return;
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  const timeEl = document.getElementById('match-time');
  entry.innerHTML = `<span class="log-time">[${timeEl ? timeEl.innerText : '??:??'}]</span> ${msg}`;
  logDiv.prepend(entry);
  while (logDiv.children.length > 200) logDiv.removeChild(logDiv.lastChild);
}

export function generateAttributes(role) {
  let a = {
    finishing:   5 + Math.random() * 10,
    passing:     8 + Math.random() * 8,
    vision:      8 + Math.random() * 8,
    dribbling:   8 + Math.random() * 8,
    pace:        10 + Math.random() * 7,
    strength:    8 + Math.random() * 8,
    aggression:  5 + Math.random() * 10,
    discipline:  8 + Math.random() * 10,
    positioning: 10 + Math.random() * 8,
    composure:   8 + Math.random() * 8,
    stamina:     12 + Math.random() * 6,
    goalkeeping: 1 + Math.random() * 4,
    heading:     8 + Math.random() * 8,
    height:      170 + Math.random() * 25,
  };

  switch (role) {
    case 'GK':
      a.goalkeeping = 12 + Math.random() * 8;
      a.finishing = 1 + Math.random() * 4;
      a.positioning = 12 + Math.random() * 6;
      a.composure = 12 + Math.random() * 6;
      a.pace = 5 + Math.random() * 7;
      a.dribbling = 2 + Math.random() * 4;
      break;
    case 'DEF':
      a.strength = 12 + Math.random() * 6;
      a.positioning = 12 + Math.random() * 6;
      a.discipline = 10 + Math.random() * 8;
      a.finishing = 4 + Math.random() * 5;
      a.aggression = 8 + Math.random() * 8;
      a.pace = 8 + Math.random() * 7;
      a.heading = 12 + Math.random() * 8;
      a.height = 180 + Math.random() * 15;
      break;
    case 'MID':
      a.passing = 12 + Math.random() * 6;
      a.vision = 12 + Math.random() * 7;
      a.stamina = 14 + Math.random() * 6;
      a.dribbling = 10 + Math.random() * 8;
      a.composure = 10 + Math.random() * 8;
      break;
    case 'FWD':
      a.finishing = 12 + Math.random() * 8;
      a.pace = 12 + Math.random() * 8;
      a.dribbling = 12 + Math.random() * 6;
      a.composure = 12 + Math.random() * 6;
      a.positioning = 12 + Math.random() * 6;
      a.heading = 10 + Math.random() * 8;
      break;
  }
  for (let k in a) a[k] = Math.min(20, Math.max(1, Math.round(a[k])));
  return a;
}
