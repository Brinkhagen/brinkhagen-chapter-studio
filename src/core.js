/* BRINKHAGEN Chapter Studio. Pure transformations are isolated for testing. */
(() => {
  'use strict';

  function chapterNumber(value) {
    const name = String(value ?? '').trim().replace(/\.md$/i, '');
    const match = name.match(/^(?:chapter|chap\.?|ch\.?)\s*[-_:# ]*0*(\d{1,6})(?=\b|\s|[-_:])/i)
      || name.match(/^0*(\d{1,6})(?=\s*[-_.:]|\s)/);
    return match ? Number(match[1]) : null;
  }

  function titleFromFilename(name) {
    return String(name ?? '').replace(/\.md$/i, '').trim().replace(/_/g, ' ');
  }

  function markdownToPlain(value) {
    let text = String(value ?? '').replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
    // Avoid repeating a first-line title in the published chapter body.
    text = text.replace(/^\s{0,3}#{1,2}\s+(?:chapter|ch\.?)\s*\d+[^\n]*\n+/i, '');
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (all, label, url) => label === url ? url : `${label} (${url})`);
    text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    text = text.replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/__([^_\n]+)__/g, '$1');
    text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1');
    text = text.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '$1');
    text = text.replace(/^\s{0,3}>\s?/gm, '');
    text = text.replace(/\\\n/g, '\n');
    return text.trim();
  }

  function normalizeTitle(value) {
    return String(value ?? '').toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
  }

  function pairChapters(files, chapters) {
    const duplicateFiles = new Set();
    const duplicateChapters = new Set();
    const fileCount = new Map();
    const chapterCount = new Map();
    for (const file of files) {
      const n = chapterNumber(file.name);
      if (n !== null) fileCount.set(n, (fileCount.get(n) || 0) + 1);
    }
    for (const ch of chapters) {
      const n = chapterNumber(ch.title);
      if (n !== null) chapterCount.set(n, (chapterCount.get(n) || 0) + 1);
    }
    for (const [n, count] of fileCount) if (count > 1) duplicateFiles.add(n);
    for (const [n, count] of chapterCount) if (count > 1) duplicateChapters.add(n);
    const matches = [];
    const errors = [];
    for (const file of files) {
      const n = chapterNumber(file.name);
      if (n === null) { errors.push(`${file.name}: no chapter number`); continue; }
      if (duplicateFiles.has(n)) { errors.push(`${file.name}: duplicate input number ${n}`); continue; }
      if (duplicateChapters.has(n)) { errors.push(`${file.name}: duplicate published number ${n}`); continue; }
      const found = chapters.find(ch => chapterNumber(ch.title) === n);
      if (!found) { errors.push(`${file.name}: chapter ${n} not found in scanned list`); continue; }
      matches.push({number: n, fileName: file.name, currentTitle: found.title, target: found});
    }
    return {matches, errors};
  }

  function formatParts(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit',
      hourCycle:'h23'
    }).formatToParts(date);
    return Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type, Number(p.value)]));
  }

  function berlinTimeToUtc(dateString, timeString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString) || !/^\d{2}:\d{2}$/.test(timeString)) {
      throw new Error('Use a valid date (YYYY-MM-DD) and time (HH:MM).');
    }
    const [year,month,day] = dateString.split('-').map(Number);
    const [hour,minute] = timeString.split(':').map(Number);
    if (hour>23 || minute>59 || new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10)!==dateString) {
      throw new Error(`Invalid date or time: ${dateString} ${timeString}`);
    }
    const target=Date.UTC(year,month-1,day,hour,minute);
    let guess=target;
    for(let i=0;i<5;i++) {
      const p=formatParts(new Date(guess),'Europe/Berlin');
      const observed=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);
      const delta=target-observed;
      guess+=delta;
      if(!delta) break;
    }
    const resolved=formatParts(new Date(guess),'Europe/Berlin');
    if(Date.UTC(resolved.year,resolved.month-1,resolved.day,resolved.hour,resolved.minute)!==target) {
      throw new Error(`Local time does not exist because of daylight-saving change: ${dateString} ${timeString}`);
    }
    // Reject repeated fall-back times: they are ambiguous without an explicit offset.
    for (const offset of [-3600000,3600000]) {
      const other=formatParts(new Date(guess+offset),'Europe/Berlin');
      if(Date.UTC(other.year,other.month-1,other.day,other.hour,other.minute)===target) {
        throw new Error(`Ambiguous local time due to daylight-saving change: ${dateString} ${timeString}`);
      }
    }
    return new Date(guess);
  }

  function createSchedule(files, startDate, dayTimes, perDay, now = Date.now()) {
    const count=Number(perDay);
    if (!Number.isInteger(count) || count<1 || count>12) throw new Error('Chapters per day must be between 1 and 12.');
    if (!Array.isArray(dayTimes) || dayTimes.length!==count) throw new Error(`Enter exactly ${count} German release times.`);
    const times=dayTimes.map(t=>String(t).trim());
    if(new Set(times).size!==times.length) throw new Error('Times must be unique within each day.');
    times.sort();
    const [y,m,d]=String(startDate).split('-').map(Number);
    if(!y || !m || !d) throw new Error('Choose a valid start date.');
    const validDate=new Date(Date.UTC(y,m-1,d));
    if(validDate.toISOString().slice(0,10)!==startDate) throw new Error('Invalid start date.');
    return files.map((file,index)=>{
      const dayOffset=Math.floor(index/count);
      const day=new Date(Date.UTC(y,m-1,d+dayOffset)).toISOString().slice(0,10);
      const localTime=times[index%count];
      const utc=berlinTimeToUtc(day,localTime);
      if(utc.getTime()<=now+60000) throw new Error(`Schedule must be in the future: ${day} ${localTime} Berlin.`);
      const inkstone=new Date(utc.getTime()+8*3600000);
      return {
        fileName:file.name,
        berlinDate:day, berlinTime:localTime,
        inkstoneDate:inkstone.toISOString().slice(0,10).replace(/-/g,'/'),
        inkstoneTime:inkstone.toISOString().slice(11,16),
        utc:utc.toISOString()
      };
    });
  }
  function localTimerFields(slot) {
    if(!slot?.berlinDate || !slot?.berlinTime) throw new Error('Schedule slot is missing local date/time.');
    return {date:slot.berlinDate.replace(/-/g,'/'),time:slot.berlinTime};
  }

  const api = Object.freeze({chapterNumber, titleFromFilename, markdownToPlain, normalizeTitle, pairChapters, berlinTimeToUtc, createSchedule, localTimerFields});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof globalThis !== 'undefined') globalThis.InkstoneProCore = api;
})();
