import Phaser from 'phaser';
import { MatchScene } from './MatchScene.js';
import { MatchEngine } from './MatchEngine.js';
import { Vector } from './utils/math.js';
import { C } from './utils/constants.js';

let engine;
export function setEngine(e) { engine = e; }
window.setMatchEngine = function(e) { engine = e; };

const config = {
  type: Phaser.AUTO,
  width: 900,
  height: 600,
  parent: 'pitch-container',
  scene: MatchScene,
  backgroundColor: '#0a0a0a'
};

document.addEventListener('DOMContentLoaded', () => {
  new Phaser.Game(config);

  // Start Menu Listeners
  document.getElementById('btn-menu-start-match').addEventListener('click', () => {
    document.getElementById('start-menu-overlay').classList.add('hidden');
    document.getElementById('btn-exit-scenario').classList.add('hidden');
    if (engine && engine.state === 'STOPPED') {
      engine.resetKickoff(0);
      document.getElementById('btn-start').innerText = 'Pause';
    }
  });

  const setupScenario = (callback) => {
    document.getElementById('start-menu-overlay').classList.add('hidden');
    document.getElementById('btn-exit-scenario').classList.remove('hidden');
    if (engine) {
      engine.resetKickoff(0); // Resets to base positions
      setTimeout(callback, 100);
      document.getElementById('btn-start').innerText = 'Pause';
    }
  };

  document.getElementById('btn-menu-corner').addEventListener('click', () => {
    setupScenario(() => {
      engine.triggerSetPiece('CORNER', new Vector(C.PITCH_W, C.PITCH_H), 0);
    });
  });

  document.getElementById('btn-menu-freekick').addEventListener('click', () => {
    setupScenario(() => {
      // Free kick right outside the penalty box for Home team
      engine.triggerSetPiece('FREE_KICK', new Vector(C.PITCH_W - C.PENALTY_BOX_W - 10, C.PITCH_H/2 + 20), 0);
    });
  });

  document.getElementById('btn-menu-offside').addEventListener('click', () => {
    setupScenario(() => {
      // Force an offside scenario
      let attacker = engine.getActivePlayers(0).find(p => p.role === 'FWD');
      let defender = engine.getActivePlayers(1).find(p => p.role === 'DEF');
      let passer = engine.getActivePlayers(0).find(p => p.role === 'MID');
      
      if (attacker && defender && passer) {
         // Place attacker blatantly offside
         attacker.pos = new Vector(C.PITCH_W - 50, C.PITCH_H/2);
         // Place defender further up
         defender.pos = new Vector(C.PITCH_W - 150, C.PITCH_H/2);
         // Give ball to passer
         passer.pos = new Vector(C.PITCH_W/2, C.PITCH_H/2);
         engine.ball.owner = null;
         engine.ball.pos = passer.pos.copy();
         // Pass the ball
         engine.ball.vel = Vector.sub(attacker.pos, passer.pos).normalize().mult(6);
         engine.ball.lastTouch = passer;
         engine.state = 'PLAYING';
      }
    });
  });

  document.getElementById('btn-exit-scenario').addEventListener('click', () => {
    document.getElementById('start-menu-overlay').classList.remove('hidden');
    document.getElementById('btn-exit-scenario').classList.add('hidden');
    if (engine) {
      engine.state = 'STOPPED';
      engine.time = 0;
      engine.half = 1;
      engine.score = { home: 0, away: 0 };
      document.getElementById('score-home').innerText = '0';
      document.getElementById('score-away').innerText = '0';
      document.getElementById('match-time').innerText = '00:00';
    }
  });

  document.getElementById('btn-start').addEventListener('click', e => {
    if (engine.state === 'STOPPED') {
      // Initial kickoff: home team kicks off
      engine.resetKickoff(0);
      e.target.innerText = 'Pause';
    } else if (['PLAYING', 'SET_PIECE', 'OUT_OF_BOUNDS'].includes(engine.state)) {
      engine.previousState = engine.state; // Remember if it was SET_PIECE or PLAYING
      engine.state = 'PAUSED'; e.target.innerText = 'Resume';
    } else if (engine.state === 'PAUSED') {
      engine.state = engine.previousState || 'PLAYING'; e.target.innerText = 'Pause';
    } else if (engine.state === 'HALF_TIME') {
      // 2nd half: away team kicks off (FIFA rule)
      engine.half = 2;
      engine.resetKickoff(1);
      e.target.innerText = 'Pause';
      logEvent('⚽ Second Half! Away team kicks off.', 'action');
    }
  });

  [1,2,5,10].forEach(s => {
    document.getElementById(`btn-speed-${s}x`).addEventListener('click', e => {
      engine.speed = s;
      document.querySelectorAll('.controls button').forEach(b => { if (b.id.startsWith('btn-speed')) b.classList.remove('active'); });
      e.target.classList.add('active');
    });
  });

  document.getElementById('btn-var-toggle').addEventListener('click', () => {
    engine.varSystem.enabled = !engine.varSystem.enabled;
  });

  // Tactic, Formation, Mentality Change Listeners
  const sf = document.getElementById('select-formation');
  if (sf) {
    sf.addEventListener('change', e => {
      if (engine) engine.applyHomeFormation(e.target.value);
    });
  }
  const st = document.getElementById('select-tactic');
  if (st) {
    st.addEventListener('change', e => {
      if (engine) engine.homeTactic = e.target.value;
    });
  }
  const sm = document.getElementById('select-mentality');
  if (sm) {
    sm.addEventListener('change', e => {
      if (engine) engine.homeMentality = e.target.value;
    });
  }
});
