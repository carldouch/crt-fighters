import test from 'node:test';
import assert from 'node:assert/strict';
import { createFight, step } from '../src/engine/fight.mjs';
import { MOVES } from '../src/engine/rules.mjs';
import { createCpu, stepCpu, observeFight, DIFFICULTIES } from '../src/engine/cpu.mjs';
import { createMatch, advanceMatch, restartMatch } from '../src/engine/match.mjs';
import { createControls, KEYMAP, mergeInput, padInput } from '../src/input/controls.mjs';

const closeFight = () => { const f = createFight(); f.p1.x = -30; f.p2.x = 30; return f; };
const observe = (f, frame) => ({ ...observeFight(f), frame });
function decisions(difficulty, fight, frames = 300, seed = 14) {
  let cpu = createCpu(difficulty, seed); const actions = [];
  for (let frame = 0; frame < frames; frame++) { const result = stepCpu(cpu, observe(fight, frame)); cpu = result.memory; actions.push(result.input); }
  return actions;
}
for (const difficulty of Object.keys(DIFFICULTIES)) {
  test(`${difficulty}: delayed, bounded, legal decisions and no observation mutation`, () => {
    const f = closeFight(); const before = structuredClone(f);
    const actions = decisions(difficulty, f);
    assert.ok(actions.slice(0, DIFFICULTIES[difficulty].reaction).every(a => !Object.values(a).some(Boolean)));
    assert.ok(actions.some(a => a.lp || a.rp || a.lk || a.rk));
    for (const a of actions) {
      assert.ok(Object.keys(a).every(k => ['forward','back','lp','rp','lk','rk'].includes(k)));
      assert.ok(['lp','rp','lk','rk'].filter(k => a[k]).length <= 1);
      assert.ok(!(a.back && (a.lp || a.rp || a.lk || a.rk)));
    }
    assert.deepEqual(f, before);
    let cpu = createCpu(difficulty);
    for (let i = 0; i < 1000; i++) cpu = stepCpu(cpu, observe(f, i)).memory;
    assert.equal(cpu.history.length, DIFFICULTIES[difficulty].reaction);
  });
  test(`${difficulty}: complete match is deterministic and ignores human P2 inputs`, () => {
    let a = createMatch({ mode: 'cpu', difficulty, seed: 971 }); let b = createMatch({ mode: 'cpu', difficulty, seed: 971 });
    for (let i = 0; i < 8500; i++) {
      const p1 = i % 150 < 65 ? { forward: true } : { lp: true };
      a = advanceMatch(a, { p1 }); b = advanceMatch(b, { p1, p2: { forward: true, rk: true } });
    }
    assert.deepEqual(a, b); assert.equal(a.fight.phase, 'over');
    assert.ok(a.fight.events.some(e => e.attacker === 'p2'));
    assert.equal(advanceMatch(a), a);
  });
}
test('difficulty changes reaction time, aggression and tactical repertoire', () => {
  const f = closeFight();
  const easy = decisions('easy', f, 3000); const hard = decisions('hard', f, 3000);
  assert.ok(hard.filter(a => a.lp || a.rp || a.lk || a.rk).length > easy.filter(a => a.lp || a.rp || a.lk || a.rk).length);
  for (const attack of ['lp','rp','lk','rk']) assert.ok(hard.some(a => a[attack]));
  f.p1.blocking = true;
  assert.ok(decisions('normal', f).some(a => a.lk));
  f.p1.blocking = false;
  f.p1.move = { key: 'forward+rk', frame: 20, hit: false };
  assert.ok(decisions('hard', f).slice(6).every(a => a.lp));
  f.p1.move = { key: 'rk', frame: 1, hit: false };
  assert.ok(decisions('hard', f).some(a => a.back));
});
test('CPU only sees public combat state; round transitions discard stale observations', () => {
  const f = createFight(); Object.defineProperty(f, 'inputs', { get() { throw new Error('Hidden inputs read'); } });
  let cpu = createCpu('hard'); const observation = observeFight(f);
  assert.equal('inputs' in observation, false); assert.equal('events' in observation, false);
  for (let i = 0; i < 30; i++) cpu = stepCpu(cpu, { ...observation, frame: i }).memory;
  const old = structuredClone(cpu); stepCpu(cpu, { ...observation, frame: 31 }); assert.deepEqual(cpu, old);
  const paused = stepCpu(cpu, { ...observation, frame: 31, phase: 'pause' });
  assert.deepEqual(paused.input, {}); assert.deepEqual(paused.memory.history, []);
  const nextRound = stepCpu(cpu, { ...observation, round: 1, frame: 31 }); assert.deepEqual(nextRound.input, {});
});
test('same seed reproduces decisions; different seeds change them; invalid settings rejected', () => {
  const f = closeFight(); assert.deepEqual(decisions('normal', f), decisions('normal', f));
  assert.notDeepEqual(decisions('normal', f, 300, 1), decisions('normal', f, 300, 2));
  assert.throws(() => createMatch({ difficulty: 'impossible' }), RangeError);
  assert.throws(() => createMatch({ mode: 'network' }), RangeError);
});
for (const [key, move] of Object.entries(MOVES)) test(`dedicated guard respects official ${key} damage and stun`, () => {
  let f = closeFight(); const guard = mergeInput({ block: true, lp: true, forward: true });
  const attack = key === 'forward+rk' ? { forward: true, rk: true } : { [key]: true };
  f = step(f, { p1: attack, p2: guard });
  for (let i = 0; i < move.startup; i++) f = step(f, { p2: guard });
  assert.equal(f.events.length, 1);
  assert.equal(f.p2.hp, move.height === 'low' ? 100 - move.damage : 100);
  assert.equal(f.p2.stun, move.height === 'low' ? move.hitstun : move.blockstun);
  assert.equal(f.p2.move, null);
});
test('dedicated guard retreats, costs no stamina, and cannot cancel an active attack', () => {
  let f = closeFight(); f = step(f, { p2: mergeInput({ block: true, rk: true }) });
  assert.equal(f.p2.x, 32); assert.equal(f.p2.blocking, true); assert.equal(f.p2.hp, 100);
  f = step(f, { p2: { lp: true } }); const started = f.p2.move.started;
  f = step(f, { p2: mergeInput({ block: true }) });
  assert.equal(f.p2.move.started, started); assert.equal(f.p2.blocking, false);
  for (let i = 0; i < 20; i++) f = step(f, { p2: mergeInput({ block: true }) });
  assert.equal(f.p2.move, null); assert.equal(f.p2.blocking, true);
  assert.equal('stamina' in f.p2, false);
});
test('MacBook and legacy keys map independently; guard wins across keyboard and gamepad', () => {
  for (const [code, action] of Object.entries({ KeyO:'lp', KeyP:'rp', KeyL:'lk', Semicolon:'rk', Numpad4:'lp', Numpad5:'rp', Numpad1:'lk', Numpad2:'rk', ArrowDown:'block' })) assert.deepEqual(KEYMAP[code], ['p2', action]);
  const target = new EventTarget(); const controls = createControls(target);
  const down = code => { const e = new Event('keydown', { cancelable:true }); Object.defineProperty(e,'code',{ value:code }); target.dispatchEvent(e); };
  down('KeyS'); down('KeyU'); down('ArrowDown'); down('KeyO');
  const sample = controls.sample();
  for (const p of ['p1','p2']) { assert.equal(sample[p].back,true); assert.equal(sample[p].lp,false); }
  controls.setActive(false); assert.deepEqual(controls.sample(), { p1:{},p2:{} }); controls.setActive(true); assert.equal(controls.sample().p2.back,undefined); controls.dispose();
  for (const index of [0,1]) {
    const pad = { connected:true, axes:[1], buttons:Array.from({length:17},(_,i)=>({pressed:[2,4].includes(i)})) };
    const action = mergeInput({ rk:true },padInput(pad,index)); assert.equal(action.back,true); assert.equal(action.forward,false); assert.equal(action.lp,false); assert.equal(action.rk,false);
  }
});
test('local PvP is exactly the original simulation; restart preserves selected settings and resets CPU seed', () => {
  let match = createMatch(); let fight = createFight();
  for (let i = 0; i < 1000; i++) { const inputs = { p1: i%70<40?{forward:true}:{lp:true},p2:i%100<50?{forward:true}:{lk:true} }; match=advanceMatch(match,inputs); fight=step(fight,inputs); }
  assert.deepEqual(match.fight,fight);
  match=restartMatch(match,{mode:'cpu',difficulty:'hard',seed:92}); const initial=structuredClone(match);
  for(let i=0;i<100;i++) match=advanceMatch(match);
  assert.deepEqual(restartMatch(match),initial);
  assert.equal(restartMatch(match,{mode:'local'}).settings.mode,'local');
});
test('current opponent state cannot alter an action before its observation delay', () => {
  const f = closeFight(); let cpu = createCpu('hard', 18);
  for (let frame = 0; frame < 30; frame++) cpu = stepCpu(cpu, observe(f, frame)).memory;
  const current = observe(f, 30); const changed = structuredClone(current);
  changed.p1.x = -400; changed.p1.move = { key:'rk',frame:0,hit:false }; changed.p1.blocking = true;
  assert.deepEqual(stepCpu(cpu, current).input, stepCpu(cpu, changed).input);
});
test('hard combines spacing and counters successfully against repeatable pressure opponents', () => {
  const wins = { easy:0, normal:0, hard:0 };
  for (const difficulty of Object.keys(wins)) for (const attack of ['lp','rp','lk','rk']) for (let seed=1;seed<=10;seed++) {
    let match=createMatch({mode:'cpu',difficulty,seed});
    for(let frame=0;frame<11000 && match.fight.phase!=='over';frame++) {
      const f=match.fight; match=advanceMatch(match,{p1:f.p2.x-f.p1.x>85?{forward:true}:{[attack]:true}});
    }
    assert.equal(match.fight.phase,'over'); wins[difficulty]+=Number(match.fight.winner==='p2');
  }
  assert.ok(wins.normal>wins.easy); assert.ok(wins.hard>wins.normal); assert.ok(wins.hard>=20);
});
