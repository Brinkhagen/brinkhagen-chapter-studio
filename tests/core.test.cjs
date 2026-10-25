const assert = require('node:assert/strict');
const test = require('node:test');
const core = require('../src/core.js');

test('floating panel stays within viewport bounds', () => {
  assert.deepEqual(core.clampPanelPosition(200,120,364,400,1440,900),{left:200,top:120});
  assert.deepEqual(core.clampPanelPosition(-100,-20,364,400,1440,900),{left:8,top:8});
  assert.deepEqual(core.clampPanelPosition(2500,1500,364,400,1440,900),{left:1068,top:492});
  assert.deepEqual(core.clampPanelPosition(400,400,364,500,320,480),{left:8,top:8});
});

test('chapter pacing refuses dangerously short and malformed delays', () => {
  assert.equal(core.normalizeDelayMs(1500),1500);
  assert.equal(core.normalizeDelayMs('3000'),3000);
  assert.equal(core.normalizeDelayMs(15000),15000);
  for(const value of [0,200,999,15001,NaN,Infinity,'fast',3200.5]) {
    assert.throws(()=>core.normalizeDelayMs(value),/between/);
  }
});

test('chapter numbers match uploader-friendly names', () => {
  assert.equal(core.chapterNumber('CH001 - First Light.md'), 1);
  assert.equal(core.chapterNumber('Chapter 21 - Fallout.md'), 21);
  assert.equal(core.chapterNumber('chapter_009: Boom'), 9);
  assert.equal(core.chapterNumber('13 - Midnight.md'), 13);
  assert.equal(core.chapterNumber('Continuity Delta.md'), null);
});

test('Markdown retains paragraphs and a readable Patreon link', () => {
  const result = core.markdownToPlain('# Chapter 01 - Start\n\nHello **world**.\n\n---\nAUTHOR\'S NOTE\n[https://www.patreon.com/cw/Nachtregen](https://www.patreon.com/cw/Nachtregen)');
  assert.ok(result.startsWith('Hello world.'));
  assert.ok(result.includes('AUTHOR\'S NOTE'));
  assert.ok(result.includes('https://www.patreon.com/cw/Nachtregen'));
});

test('unique exact chapter number matches', () => {
  const files = [{name:'CH01 - New.md'},{name:'CH02 - Revised.md'}];
  const chapters = [{title:'Chapter 1 - Old',href:'https://inkstone.webnovel.com/a'}, {title:'Chapter 2 - Older',href:'https://inkstone.webnovel.com/b'}];
  const {matches,errors} = core.pairChapters(files,chapters);
  assert.equal(matches.length,2);
  assert.deepEqual(errors,[]);
  assert.equal(matches[0].currentTitle,'Chapter 1 - Old');
});

test('ambiguous published chapters are rejected', () => {
  const files=[{name:'CH01 - Edit.md'}];
  const chapters=[{title:'Chapter 1 - One'},{title:'CH01 - Duplicate'}];
  const result=core.pairChapters(files,chapters);
  assert.equal(result.matches.length,0);
  assert.match(result.errors[0],/duplicate published/);
});

test('missing or duplicated input chapters are rejected', () => {
  let result=core.pairChapters([{name:'CH099 - Missing.md'}],[{title:'CH01 - Existing'}]);
  assert.equal(result.matches.length,0);
  assert.match(result.errors[0],/not found/);
  result=core.pairChapters([{name:'CH01 - A.md'},{name:'Chapter 1 - B.md'}],[{title:'CH01 - Existing'}]);
  assert.equal(result.matches.length,0);
  assert.equal(result.errors.length,2);
});

test('four daily slots stay at German wall-clock times across DST', () => {
  const files=Array.from({length:8},(_,i)=>({name:`CH${i+1} - Test.md`}));
  const schedule=core.createSchedule(files,'2026-10-24',['08:00','12:00','16:00','20:00'],4,Date.UTC(2026,9,23));
  assert.equal(schedule.length,8);
  assert.equal(schedule[0].inkstoneTime,'14:00'); // Berlin summer time -> UTC+8
  assert.equal(schedule[4].inkstoneTime,'15:00'); // Berlin winter time -> UTC+8
  assert.equal(schedule[7].berlinDate,'2026-10-25');
});

test('nonexistent and ambiguous German DST times are rejected', () => {
  assert.throws(()=>core.berlinTimeToUtc('2026-03-29','02:30'),/does not exist/);
  assert.throws(()=>core.berlinTimeToUtc('2026-10-25','02:30'),/Ambiguous/);
});

test('Inkstone picker receives Berlin local time, never GMT+8 time', () => {
  const [slot]=core.createSchedule([{name:'Chapter - 160 The Dark Red Greatsword.md'}],
    '2026-10-26',['08:00'],1,Date.UTC(2026,9,25));
  assert.equal(slot.inkstoneTime,'15:00');
  assert.deepEqual(core.localTimerFields(slot),{date:'2026/10/26',time:'08:00'});
});
