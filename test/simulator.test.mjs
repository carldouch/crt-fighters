import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (args) => {
  const result = spawnSync(process.execPath, ['bin/simulate.mjs', ...args], { encoding: 'utf8', env: { PATH: process.env.PATH, LANG: 'C.UTF-8', TZ: 'UTC' } });
  if (result.error) throw result.error;
  return result;
};
test('CLI refuses malformed files with exit 2, stderr reason and empty stdout', () => {
  const dir = mkdtempSync(join(tmpdir(), 'crt-cli-'));
  try {
    const file = join(dir, 'inputs.json');
    for (const text of ['{', 'null', '{"frames":[null]}', '{"frames":[{"p1":null}]}', '{"frames":[{"repeat":"4"}]}']) {
      writeFileSync(file, text); const r = run([file]);
      assert.equal(r.status, 2); assert.equal(r.stdout, ''); assert.match(r.stderr, /simulate:/);
    }
    for (const args of [[], [join(dir, 'missing')], [dir], [file, file]]) {
      const r = run(args); assert.equal(r.status, 2); assert.equal(r.stdout, ''); assert.ok(r.stderr.trim());
    }
  } finally { rmSync(dir, { recursive: true }); }
});
test('CLI output is byte-stable and ends in one newline', () => {
  const dir = mkdtempSync(join(tmpdir(), 'crt-cli-'));
  try {
    const file = join(dir, 'inputs.json'); writeFileSync(file, JSON.stringify({ frames: [{ p1: 'forward', repeat: 67 }, { p1: 'lp', p2: 'rk', repeat: 200 }] }));
    const a = run([file]), b = run([file]); assert.equal(a.status, 0); assert.equal(a.stderr, ''); assert.equal(a.stdout, b.stdout); assert.equal(a.stdout.split('\n').length, 2);
    assert.equal(JSON.parse(a.stdout).events[0].frame, 73);
  } finally { rmSync(dir, { recursive: true }); }
});
