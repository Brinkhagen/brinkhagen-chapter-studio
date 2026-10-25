'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = path.join(__dirname, '..');

test('manifest uses BRINKHAGEN branding and valid Chrome icons', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'BRINKHAGEN Chapter Studio');
  assert.equal(manifest.version, '0.3.2');
  for (const size of [16, 32, 48, 128]) {
    const file = path.join(base, manifest.icons[size]);
    const icon = fs.readFileSync(file);
    assert.deepEqual(icon.subarray(0, 8), Buffer.from('89504e470d0a1a0a', 'hex'));
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
  }
});

test('panel includes logo, version and copyright while preserving stored queue', () => {
  const script = fs.readFileSync(path.join(base, 'src/content.js'), 'utf8');
  assert.match(script, /BRINKHAGEN SOFTWARE/);
  assert.match(script, /Chapter Studio/);
  assert.match(script, /© 2026 BRINKHAGEN/);
  assert.match(script, /inkstoneProStateV1/);
  assert.match(script, /Save as Draft/);
  assert.match(script, /preparePublishTimer/);
  assert.match(script, /verify-editor/);
  assert.match(script, /Back up & replace matched chapters/);
  assert.match(script, /job\.autoApply/);
  assert.doesNotMatch(script, /!backupReady \|\| !state\.backupExported/);
});
