(() => {
  'use strict';
  if (window.__inkstoneProInitialized || !window.InkstoneProCore) return;
  window.__inkstoneProInitialized = true;

  const Core = window.InkstoneProCore;
  const KEY = 'inkstoneProStateV1';
  const SESSION_KEY = 'inkstoneProRunId';
  const DELAY = 1000;
  const SCHEMA_VERSION = 2;
  let busy = false;
  let scheduled = null;
  let minimized = false;
  let latest = null;

  function initialStartDate() {
    return new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'})
      .format(new Date(Date.now()+24*60*60*1000));
  }

  const fresh = () => ({
    mode: 'replace', files: [], chapters: [], matches: [], errors: [],
    backups: [], backupExported: false, job: null,
    delivery: 'draft', scheduleStartDate: initialStartDate(),
    schedulePerDay: 4, scheduleTimes: '08:00, 12:00, 16:00, 20:00',
    autoConfirmSchedule: false,
    note: 'Select your Markdown files to begin.'
  });
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function getState() {
    const saved = (await chrome.storage.local.get(KEY))[KEY];
    return saved && typeof saved === 'object' ? {...fresh(), ...saved} : fresh();
  }
  async function putState(state) {
    latest = state;
    await chrome.storage.local.set({[KEY]: state});
    render(state);
  }
  async function amend(updater) {
    const state = await getState();
    await updater(state);
    await putState(state);
    return state;
  }
  async function fail(message) {
    sessionStorage.removeItem(SESSION_KEY);
    return amend(s => {
      if (s.job) s.job.status = 'paused';
      s.note = `Paused: ${message}`;
    });
  }
  function visible(el) {
    if (!(el instanceof HTMLElement) || el.closest('#inkstone-pro-root')) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
  }
  function localUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(url, location.href);
      if (u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return '';
      return u.href;
    } catch { return ''; }
  }
  function bookId(url = location.href) {
    try {
      const parsed = new URL(url, location.href);
      return parsed.searchParams.get('bookId') || parsed.searchParams.get('book_id')
        || parsed.pathname.match(/(?:book|novel|story)[/\-](\d{8,})/i)?.[1] || '';
    } catch { return ''; }
  }
  function checkBook(job) {
    const observed = bookId();
    if (job.bookId && observed && job.bookId !== observed) {
      throw new Error(`Wrong novel: expected book ${job.bookId}, page shows ${observed}. No action taken.`);
    }
  }
  const normalizedBody = text => String(text ?? '').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').trim();
  function candidates(selector, predicate = () => true) {
    return [...document.querySelectorAll(selector)].filter(el => visible(el) && predicate(el));
  }
  function clickableText(el) {
    return (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim().replace(/\s+/g, ' ');
  }
  function actionButton(words, dialogOnly = false) {
    const nodes = candidates('button, [role=button], input[type=submit]');
    const scope = dialogOnly ? nodes.filter(el => !!el.closest('[role=dialog], .ant-modal, .modal, .el-dialog')) : nodes;
    const matches = scope.filter(el => words.some(word => new RegExp(`^${word}$`, 'i').test(clickableText(el))));
    return matches.length === 1 ? matches[0] : null;
  }
  function publishDialog() {
    return candidates('[role=dialog], .ant-modal, .modal, .el-dialog')
      .find(el => /confirm publish|publish timer/i.test(el.textContent));
  }
  function publishTimerSwitch(dialog) {
    const labels=[...dialog.querySelectorAll('*')]
      .filter(el=>el.children.length===0 && /^publish timer$/i.test((el.textContent||'').trim()));
    for(const label of labels) {
      let cur=label;
      for(let i=0;i<4&&cur;i++,cur=cur.parentElement) {
        const controls=[...cur.querySelectorAll('[role=switch], .ant-switch, input[type=checkbox]')];
        if(controls.length===1)return controls[0];
      }
    }
    const all=[...dialog.querySelectorAll('[role=switch], .ant-switch')];
    return all.length===1?all[0]:null;
  }
  function switchEnabled(el) {
    if(el.tagName==='INPUT')return el.checked;
    return el.getAttribute('aria-checked')==='true' || el.classList.contains('ant-switch-checked');
  }
  function findTimerInputs(dialog) {
    const inputs=[...dialog.querySelectorAll('input')].filter(el=>!el.disabled && visible(el));
    const date=inputs.filter(el=>el.type==='date' || /date|yyyy|20\d{2}[/-]\d{2}[/-]\d{2}/i.test([el.placeholder,el.value,el.getAttribute('aria-label')].join(' ')));
    const time=inputs.filter(el=>el.type==='time' || /time|\d{1,2}:\d{2}/i.test([el.placeholder,el.value,el.getAttribute('aria-label')].join(' ')));
    return {date:date.length===1?date[0]:null,time:time.length===1?time[0]:null};
  }
  async function preparePublishTimer(entry) {
    const dialog=publishDialog();
    if(!dialog) throw new Error('Publish Timer dialog not found. No publication confirmed.');
    const toggle=publishTimerSwitch(dialog);
    if(!toggle) throw new Error('Publish Timer switch not identified. Set it manually, then verify the selected date and time.');
    if(!switchEnabled(toggle)) toggle.click();
    await pause(400);
    // Current Inkstone UI explicitly says the picker expects the user's LOCAL
    // clock and converts to GMT+8 itself. Never feed the converted GMT+8 values
    // into this picker, as that would shift releases by the offset twice.
    if(!/based on your local time|convert it to gmt\s*\+\s*8/i.test(dialog.textContent)) {
      throw new Error('Cannot verify whether this Publish Timer expects local time. Inspect the timezone warning before confirming.');
    }
    const local=Core.localTimerFields(entry);
    const {date,time}=findTimerInputs(dialog);
    if(!date||!time) throw new Error(`Set LOCAL date ${local.date} and time ${local.time} manually (expected conversion: ${entry.inkstoneDate} ${entry.inkstoneTime} GMT+8).`);
    const desiredDate=date.type==='date'?entry.berlinDate:local.date;
    if(date.readOnly || time.readOnly)throw new Error(`Timer uses a custom picker. Set LOCAL ${local.date} ${local.time} manually, NOT ${entry.inkstoneTime} (GMT+8).`);
    setNativeValue(date,desiredDate);setNativeValue(time,local.time);
    date.blur();time.blur();
    await pause(300);
    const dateValue=date.value.replace(/-/g,'/');
    const timeValue=time.value.slice(0,5);
    if(dateValue!==local.date || timeValue!==local.time) {
      throw new Error(`The timer did not retain LOCAL ${local.date} ${local.time}. Set it manually.`);
    }
    // Text boxes in custom frameworks can display values without committing their state.
    const expectedConverted=`${entry.inkstoneDate.replace(/\//g,'-')} ${entry.inkstoneTime}`;
    const convertedText=(dialog.textContent||'').replace(/\s+/g,' ');
    return date.type==='date' && time.type==='time' && convertedText.includes(expectedConverted);
  }
  function findTitleInput() {
    const known=candidates('.input_title--plhUv, input[placeholder="Title Here"]');
    if(known.length===1)return known[0];
    const els = candidates('input:not([type=hidden]):not([type=file]), textarea');
    const scored = els.map(el => {
      const a = [el.placeholder, el.name, el.id, el.getAttribute('aria-label'),el.outerHTML.slice(0,300)].filter(Boolean).join(' ').toLowerCase();
      let score = /chapter.{0,12}(title|name)|(?:title|name).{0,12}chapter/.test(a) ? 20 : 0;
      if (/title/.test(a)) score += 8;
      if (/search|login|email|password|description|synopsis/.test(a)) score -= 35;
      if (el.tagName === 'INPUT') score += 2;
      return {el, score};
    }).sort((a,b) => b.score-a.score);
    return scored[0]?.score >= 8 && (!scored[1] || scored[0].score > scored[1].score) ? scored[0].el : null;
  }
  function findBodyField() {
    // Inkstone's chapter editor uses TinyMCE in a SAME-ORIGIN iframe; its
    // contenteditable body is not part of the top document's querySelectorAll.
    const tinyFrames=candidates('iframe.tox-edit-area__iframe, iframe[id*="tinymce"], iframe[title*="Rich Text"]');
    for(const frame of tinyFrames) {
      try {
        const body=frame.contentDocument?.body;
        if(body && (body.isContentEditable || body.getAttribute('contenteditable')==='true'))return body;
      } catch { /* Cross-origin iframe: never attempt to edit it. */ }
    }
    const els = candidates('[contenteditable=true], [role=textbox], textarea').filter(el => el !== findTitleInput());
    const scored = els.map(el => {
      const meta = [el.className,el.id,el.getAttribute('data-placeholder'),el.getAttribute('aria-label'),el.placeholder].filter(Boolean).join(' ').toLowerCase();
      let score = el.isContentEditable ? 12 : 0;
      if (/ql-editor|prosemirror|drafteditor|tiptap|rich|content|chapter|editor/.test(meta)) score += 15;
      if (/search|comment|note|title|synopsis|description/.test(meta)) score -= 15;
      score += Math.min(8, ((el.innerText || el.value || '').length / 1000));
      return {el, score};
    }).sort((a,b)=>b.score-a.score);
    return scored[0]?.score >= 10 && (!scored[1] || scored[0].score > scored[1].score) ? scored[0].el : null;
  }
  function readEditor() {
    const title = findTitleInput(), body = findBodyField();
    if (!title || !body) return null;
    return {
      title: title.value ?? '',
      body: body.isContentEditable ? (body.innerText ?? body.textContent ?? '') : (body.value ?? ''),
      bodyHtml: body.isContentEditable ? body.innerHTML : null,
      url: location.href,
      capturedAt: new Date().toISOString()
    };
  }
  function inkstoneEditorVisible() {
    return !!findTitleInput() && !!document.querySelector('iframe.tox-edit-area__iframe');
  }
  async function ensureEditor() {
    let data = readEditor();
    if (data) return data;
    // WebNovel's documented chapter editor may require a separate Update click.
    const update = actionButton(['Update', 'Edit', 'Modify']);
    if (update) {
      update.click();
      await pause(900);
      data = readEditor();
    }
    return data;
  }
  function setNativeValue(el, value) {
    const prototype = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new InputEvent('input', {bubbles:true,inputType:'insertText',data:value}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function setRichText(el, value) {
    const doc=el.ownerDocument;
    el.focus();
    const selection = doc.getSelection();
    const range = doc.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges(); selection.addRange(range);
    let inserted = false;
    try { inserted = doc.execCommand('insertText', false, value); } catch { /* fallback */ }
    if (!inserted || (el.innerText || '').trim() !== value.trim()) {
      el.replaceChildren();
      for (const paragraph of value.split(/\n\n+/)) {
        const p = doc.createElement('p');
        const lines = paragraph.split('\n');
        lines.forEach((line,i) => { if (i) p.append(doc.createElement('br')); p.append(doc.createTextNode(line)); });
        el.append(p);
      }
    }
    el.dispatchEvent(new InputEvent('input', {bubbles:true,inputType:'insertText',data:null}));
    el.dispatchEvent(new Event('change', {bubbles:true}));
    el.blur();
  }
  function fillEditor(name, raw) {
    const title = findTitleInput(), body = findBodyField();
    if (!title || !body) throw new Error('Cannot identify unique title and body fields. No edits were made.');
    const content = Core.markdownToPlain(raw);
    if (content.length < 25) throw new Error('File body is too short; refused to replace chapter.');
    setNativeValue(title, Core.titleFromFilename(name));
    if (body.isContentEditable) setRichText(body, content);
    else setNativeValue(body, content);
    return {title: Core.titleFromFilename(name), chars: content.length};
  }

  function scanList() {
    const found = new Map();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node, seen = 0;
    while ((node = walker.nextNode()) && seen++ < 50000) {
      const parent = node.parentElement;
      if (!parent || parent.closest('#inkstone-pro-root') || !visible(parent)) continue;
      const text = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (text.length < 3 || text.length > 180 || Core.chapterNumber(text) === null) continue;
      const link = parent.closest('a[href]') || parent.querySelector('a[href]');
      const title = text;
      const href = link ? localUrl(link.getAttribute('href')) : '';
      const existing = found.get(Core.normalizeTitle(title));
      if (!existing || (!existing.href && href)) found.set(Core.normalizeTitle(title), {title,href});
    }
    return [...found.values()].sort((a,b)=>(Core.chapterNumber(a.title)||0)-(Core.chapterNumber(b.title)||0));
  }
  function findListTarget(target) {
    const norm = Core.normalizeTitle(target.title);
    const links = candidates('a[href]').filter(a => Core.normalizeTitle(a.textContent) === norm);
    if (links.length === 1) return links[0];
    const all = candidates('button, [role=button], a, span, div');
    const list = all.filter(el => {
      if (el.children.length > 2) return false;
      return Core.normalizeTitle(el.textContent) === norm;
    });
    list.sort((a,b)=>a.textContent.length-b.textContent.length);
    return list.length ? list[0] : null;
  }
  function progress(job) {
    const total = job?.entries?.length || 0;
    const completed = Math.min(total, job?.index || 0);
    return total ? Math.round(completed / total * 100) : 0;
  }
  function reroute(url) {
    if (!localUrl(url)) throw new Error('Navigation target is not on the current Inkstone origin.');
    location.assign(url);
  }
  async function advance(state, patch) {
    Object.assign(state.job, patch);
    await putState(state);
  }
  async function navigateToEntry(state) {
    const job = state.job, entry = job.entries[job.index];
    if (!entry) return;
    await advance(state, {phase:'editor'});
    const url = localUrl(entry.target?.href);
    if (url) return reroute(url);
    if (location.href !== job.listUrl) return reroute(job.listUrl);
    const el = findListTarget(entry.target);
    if (!el) throw new Error(`Cannot click chapter ${entry.number}. Scan the Published page again.`);
    el.click();
    scheduleRun(1100);
  }
  async function returnToList(state) {
    const job = state.job;
    await advance(state,{index:job.index+1,phase:'list'});
    if (location.href !== job.listUrl) reroute(job.listUrl);
    else scheduleRun(DELAY);
  }
  async function runBackup(state) {
    const job = state.job;
    if (job.index >= job.entries.length) {
      job.status = 'backups-ready';
      state.note = `Captured ${state.backups.length} backups. Export the backup before applying ${job.mode} actions.`;
      sessionStorage.removeItem(SESSION_KEY);
      return putState(state);
    }
    if (job.phase === 'list') return navigateToEntry(state);
    const chapter = await ensureEditor();
    if (!chapter || chapter.body.trim().length < 5) throw new Error(`Could not read existing chapter ${job.entries[job.index].number}; nothing changed.`);
    const expected = job.entries[job.index].number;
    const actual = Core.chapterNumber(chapter.title);
    if (actual !== expected) throw new Error(`Expected chapter ${expected}, editor shows ${chapter.title || '(untitled)'}.`);
    const backup = {...chapter, number:expected, originalTitle:chapter.title};
    state.backups = state.backups.filter(b => b.number !== expected).concat(backup);
    await putState(state);
    return returnToList(state);
  }
  async function runReplace(state) {
    const job = state.job;
    if (job.index >= job.entries.length) {
      job.status = 'complete';
      state.note = 'All update actions were submitted. Check published chapters on WebNovel manually.';
      sessionStorage.removeItem(SESSION_KEY);
      return putState(state);
    }
    if (job.phase === 'list') return navigateToEntry(state);
    const chapter = await ensureEditor();
    if (!chapter) throw new Error('Editor not found.');
    const entry = job.entries[job.index];
    if (Core.chapterNumber(chapter.title) !== entry.number) throw new Error(`Chapter mismatch: expected ${entry.number}, found ${chapter.title}.`);
    const backup = state.backups.find(b => b.number === entry.number);
    if (!backup) throw new Error(`Missing original backup for chapter ${entry.number}.`);
    if (normalizedBody(chapter.body) !== normalizedBody(backup.body)) {
      throw new Error(`Chapter ${entry.number} changed since the backup. Refresh your scan and backup before replacing.`);
    }
    const file = state.files.find(f => f.name === entry.fileName);
    if (!file) throw new Error(`Missing local file ${entry.fileName}.`);
    fillEditor(file.name, file.text);
    await pause(300);
    const save = actionButton(['Update','Save','Save Changes','Confirm Changes','Submit']);
    if (!save) throw new Error(`Chapter ${entry.number} was filled but no unique Save/Update button was identified. Save manually, then resume with caution.`);
    await advance(state, {phase:'submitted'});
    save.click();
    await pause(1000);
    // A final confirmation may appear after saving; never confirm an unrelated modal.
    const confirm = actionButton(['Confirm','Yes'], true);
    if (confirm) confirm.click();
    await pause(800);
    return returnToList(state);
  }
  async function runDelete(state) {
    const job = state.job;
    if (job.index >= job.entries.length) {
      job.status = 'complete';
      state.note = 'All delete clicks were submitted. Verify the Published/Trash list manually.';
      sessionStorage.removeItem(SESSION_KEY);
      return putState(state);
    }
    if (job.phase === 'list') return navigateToEntry(state);
    const chapter = await ensureEditor();
    if (!chapter) throw new Error('Existing chapter editor not found; deletion refused.');
    const entry = job.entries[job.index];
    if (Core.chapterNumber(chapter.title) !== entry.number) throw new Error('Wrong chapter in editor; deletion refused.');
    const backup = state.backups.find(b => b.number === entry.number);
    if (!backup || !state.backupExported) throw new Error('No exported backup; deletion refused.');
    if (normalizedBody(chapter.body) !== normalizedBody(backup.body)) throw new Error('Chapter content changed since backup; deletion refused.');
    const deleteButton = actionButton(['Delete Chapter','Move to Trash','Delete']);
    if (!deleteButton) throw new Error('No unique chapter delete button found. Deletion not attempted.');
    await advance(state,{phase:'delete-confirm'});
    deleteButton.click();
    await pause(700);
    const dialog = candidates('[role=dialog], .ant-modal, .modal, .el-dialog')
      .find(el => /delete|trash|remove/i.test(el.textContent));
    if (!dialog) throw new Error('Deletion confirmation dialog not recognized. No confirmation was clicked.');
    const confirm = actionButton(['Delete','Confirm','Yes','Move to Trash'],true);
    if (!confirm) throw new Error('No unique deletion confirmation button. Confirm manually if desired.');
    confirm.click();
    await pause(800);
    return returnToList(state);
  }
  async function runUpload(state) {
    const job = state.job;
    if (job.index >= job.entries.length) {
      job.status = 'complete';
      state.note = 'All upload actions submitted. Verify the chapter list.';
      sessionStorage.removeItem(SESSION_KEY);
      return putState(state);
    }
    if (job.phase === 'create') {
      // When an older version misidentified the open editor, Resume must
      // recover on that same blank editor instead of searching Create Chapter.
      if (readEditor() || inkstoneEditorVisible()) {
        await advance(state,{phase:'editor'});
        return scheduleRun(300);
      }
      const create = actionButton(['Create Chapter','New Chapter','Add Chapter']);
      if (!create) {
        if (job.listUrl && location.href!==job.listUrl) return reroute(job.listUrl);
        throw new Error('Create Chapter button not found. Open a blank chapter editor, then Resume.');
      }
      await advance(state,{phase:'editor'});
      create.click();
      scheduleRun(DELAY);
      return;
    }
    if (job.phase === 'publish-confirm') {
      const dialog = publishDialog();
      if (!dialog) throw new Error('Publish confirmation dialog missing. Check whether chapter was published before resuming.');
      if (job.delivery==='schedule') {
        const slot=job.entries[job.index];
        const nativeTimerVerified=await preparePublishTimer(slot);
        if (!job.autoConfirmSchedule || !nativeTimerVerified) {
          job.status='paused';job.phase='await-manual-confirm';
          state.note=`Enter LOCAL ${slot.berlinDate.replace(/-/g,'/')} ${slot.berlinTime} in the Publish Timer. The RED converted value should show ${slot.inkstoneDate.replace(/\//g,'-')} ${slot.inkstoneTime} (GMT+8). Confirm manually, verify it is scheduled, then press "I confirmed; next".`;
          sessionStorage.removeItem(SESSION_KEY);
          return putState(state);
        }
      }
      const confirm = actionButton(['Confirm','Publish','Yes'], true);
      if (!confirm) throw new Error('Publish confirmation button missing.');
      await advance(state,{phase:'after-publish'});
      confirm.click();
      scheduleRun(1400);
      return;
    }
    if (job.phase === 'await-manual-confirm') {
      throw new Error('Confirm the timer on WebNovel first, then use "I confirmed; next".');
    }
    if (job.phase === 'after-publish' || job.phase === 'after-save') {
      await advance(state,{index:job.index+1,phase:'create'});
      if(job.listUrl && location.href!==job.listUrl)return reroute(job.listUrl);
      scheduleRun(DELAY);
      return;
    }
    const file = state.files.find(f=>f.name === job.entries[job.index].fileName);
    if (!file) throw new Error('Input file missing.');
    let current = readEditor();
    if (!current && inkstoneEditorVisible()) {
      await pause(1200);
      current = readEditor();
    }
    if (!current) throw new Error('Blank chapter editor not found. Open Create Chapter and resume.');
    if ((current.title.trim() && !/^untitled$/i.test(current.title.trim())) || current.body.trim()) {
      throw new Error('This editor is not blank. Refusing to overwrite existing text during Upload. Open Create Chapter and resume.');
    }
    fillEditor(file.name,file.text);
    if (job.delivery==='draft') {
      const save=actionButton(['Save','Save Draft','Save as Draft']);
      if (!save) throw new Error('Chapter text filled, but Save/Save Draft button not uniquely found. Save manually; do not continue blindly.');
      await advance(state,{phase:'after-save'});
      save.click();
      scheduleRun(1300);
      return;
    }
    const publish = actionButton(['Publish','Publish Chapter']);
    if (!publish) throw new Error('Publish button not uniquely found; chapter filled but not published/scheduled.');
    await advance(state,{phase:'publish-confirm'});
    publish.click();
    scheduleRun(900);
  }
  async function execute() {
    if (busy) return;
    busy = true;
    try {
      const state = await getState();
      const job = state.job;
      if (!job || job.status !== 'running') return;
      if (job.schemaVersion!==SCHEMA_VERSION) {
        await fail('This queue was created by the older extension. Clear local queue and import files again.');
        return;
      }
      if (sessionStorage.getItem(SESSION_KEY) !== job.id) {
        await fail('The tab session changed; press Resume to continue safely.');
        return;
      }
      checkBook(job);
      if (job.stage === 'backup') await runBackup(state);
      else if (job.mode === 'replace') await runReplace(state);
      else if (job.mode === 'delete') await runDelete(state);
      else await runUpload(state);
    } catch (error) {
      await fail(error?.message || String(error));
    } finally {
      busy = false;
    }
  }
  function scheduleRun(ms = 600) {
    clearTimeout(scheduled);
    scheduled = setTimeout(execute, ms);
  }
  function bindMatches(state) {
    const {matches,errors} = Core.pairChapters(state.files, state.chapters);
    state.matches = matches; state.errors = errors;
  }
  function downloadBackup(state) {
    const json = JSON.stringify({
      format:'InkstoneUploaderProBackup-v1',
      createdAt:new Date().toISOString(), sourceUrl:state.job?.listUrl || location.href,
      chapters:state.backups
    }, null, 2);
    const blob = new Blob([json],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href=url; anchor.download=`inkstone-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function scheduleFor(state) {
    const browserZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
    if(!['Europe/Berlin','Europe/Busingen'].includes(browserZone)) {
      throw new Error(`Chrome timezone is ${browserZone}, not Europe/Berlin. Inkstone expects your device's local time. Correct the device timezone before scheduling.`);
    }
    return Core.createSchedule(
      state.files,
      state.scheduleStartDate,
      String(state.scheduleTimes).split(',').map(v=>v.trim()),
      Number(state.schedulePerDay)
    );
  }
  function downloadSchedule(state) {
    const plan=scheduleFor(state);
    const quoted=v=>`"${String(v).replace(/"/g,'""')}"`;
    const rows=[['File','Berlin Date','Berlin Time','Inkstone GMT+8 Date','Inkstone GMT+8 Time','UTC']]
      .concat(plan.map(p=>[p.fileName,p.berlinDate,p.berlinTime,p.inkstoneDate,p.inkstoneTime,p.utc]));
    const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(quoted).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='inkstone-publishing-plan.csv';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function makeJob(state, stage, mode = state.mode) {
    const uploadPlan=mode==='upload' && state.delivery==='schedule' ? scheduleFor(state) : null;
    const entries = mode === 'upload'
      ? state.files.map((f,i) => ({number:Core.chapterNumber(f.name),fileName:f.name,...(uploadPlan?.[i]||{})}))
      : state.matches.map(m=>({...m}));
    const uploadEditor=mode==='upload' && (!!readEditor() || inkstoneEditorVisible());
    return {
      id:`${Date.now()}-${Math.random().toString(36).slice(2)}`, stage, mode,
      entries, listUrl:mode==='upload' && uploadEditor ? '' : location.href,
      index:0, phase:stage === 'backup' ? 'list' : mode === 'upload' ? (uploadEditor?'editor':'create') : 'list',
      status:'running', delivery:state.delivery, autoConfirmSchedule:state.autoConfirmSchedule,
      schemaVersion:SCHEMA_VERSION, bookId:bookId()
    };
  }
  async function importFiles(input) {
    const selected = [...(input.files || [])].filter(f=>/\.md$/i.test(f.name));
    if (!selected.length) return amend(s=>{s.note='Choose at least one .md file.';});
    if (selected.length>500) return amend(s=>{s.note='Maximum 500 files per batch.';});
    const files = await Promise.all(selected.map(async file=>({name:file.name,text:await file.text()})));
    if (files.some(f=>f.text.length>500000)) return amend(s=>{s.note='A file exceeds 500,000 characters.';});
    files.sort((a,b)=>(Core.chapterNumber(a.name)||0)-(Core.chapterNumber(b.name)||0));
    await amend(s=>{
      if (s.job?.status==='running') throw new Error('Pause the current job before importing new files.');
      s.files=files;s.backups=[];s.backupExported=false;s.job=null;bindMatches(s);
      s.note=`Imported ${files.length} Markdown chapters. Keep this Chrome profile for the stored queue.`;
    });
  }
  async function handleAction(action) {
    const s = await getState();
    if (action==='min') {minimized=!minimized;return render(s);}
    if (action==='debug-editor') {
      const title=findTitleInput();
      const body=findBodyField();
      const tiny=[...document.querySelectorAll('iframe.tox-edit-area__iframe')].length;
      return amend(state=>{
        state.note=`Editor diagnostics: title=${title ? title.tagName+' '+(title.className||title.placeholder||'') : 'NOT FOUND'}; body=${body ? body.tagName+' '+(body.id||body.className||'') : 'NOT FOUND'}; TinyMCE iframes=${tiny}. No changes made.`;
      });
    }
    if (action==='scan') return amend(state=>{
      state.chapters=scanList();bindMatches(state);
      state.job=null;state.backups=[];state.backupExported=false;
      state.note=`Scanned ${state.chapters.length} visible chapter titles. Check that ALL target chapters are displayed.`;
    });
    if (action==='select-all-deletion') return amend(state=>{
      if(state.mode!=='delete' || !state.chapters.length) {
        state.note='Scan the Published list first.';return;
      }
      state.files=state.chapters.map(ch=>({name:`${ch.title}.md`,text:''}));
      state.job=null;state.backups=[];state.backupExported=false;
      bindMatches(state);
      state.note=`Selected ${state.matches.length} scanned titles for deletion. This is NOT necessarily every chapter in the novel: check all Published pages.`;
    });
    if (action==='clear') {
      if (!confirm('Clear the imported files, scan, progress and backups stored by this extension?')) return;
      sessionStorage.removeItem(SESSION_KEY);
      return putState(fresh());
    }
    if (action==='pause') {
      sessionStorage.removeItem(SESSION_KEY);
      return amend(state=>{if(state.job)state.job.status='paused';state.note='Paused by user.';});
    }
    if (action==='resume') {
      if (!s.job || s.job.status==='complete') return;
      s.job.status='running';s.note='Resuming from saved position.';
      sessionStorage.setItem(SESSION_KEY,s.job.id);
      await putState(s);return scheduleRun(500);
    }
    if (action==='mark-next') {
      const job=s.job;
      if (!job || job.status!=='paused' || job.mode!=='upload' || job.delivery!=='schedule'
        || !['await-manual-confirm','publish-confirm'].includes(job.phase)) return;
      if (!confirm('Have you manually confirmed this chapter in Inkstone AND verified its scheduled date/time? Only then continue.')) return;
      job.index+=1;job.phase='create';job.status='running';
      s.note='Manual scheduling confirmed by user. Continuing with next chapter.';
      sessionStorage.setItem(SESSION_KEY,job.id);
      await putState(s);
      if(job.listUrl && location.href!==job.listUrl)return reroute(job.listUrl);
      return scheduleRun(500);
    }
    if(action==='export-schedule') {
      downloadSchedule(s);
      return amend(state=>{state.note='Publishing plan CSV download started. Check the dates/times before scheduling.';});
    }
    if (action==='fill') {
      const file=s.files[0];
      if (!file) return amend(state=>{state.note='Import a .md chapter first.';});
      await ensureEditor();
      const current=readEditor();
      if (current?.body.trim() && !confirm('This editor already contains text. Replace its UNSAVED content with the first file?')) return;
      const result=fillEditor(file.name,file.text);
      return amend(state=>{state.note=`Filled ${result.title}; nothing was published. Review and save manually.`;});
    }
    if (action==='backup') {
      bindMatches(s);
      if (!s.files.length || s.errors.length || s.matches.length!==s.files.length) {
        s.note='All input chapters must have ONE unique match in the scan before backups can start.';
        return putState(s);
      }
      s.backups=[];s.backupExported=false;s.job=makeJob(s,'backup');
      s.note='Backup pass started. The extension will visit each matching chapter without editing it.';
      sessionStorage.setItem(SESSION_KEY,s.job.id);
      await putState(s);return scheduleRun(400);
    }
    if (action==='export') {
      if (!s.backups.length) return;
      downloadBackup(s);
      return amend(state=>{state.backupExported=true;state.note='Backup download initiated. Confirm it exists on your computer before applying changes.';});
    }
    if (action==='apply') {
      if (!s.job || s.job.status!=='backups-ready' || !s.backupExported || s.backups.length!==s.job.entries.length) return;
      if (s.job.mode==='delete') {
        const phrase=`DELETE ${s.job.entries.length}`;
        const input=document.getElementById('inkstone-pro-delete-phrase');
        if (input?.value !== phrase) return amend(state=>{state.note=`Type ${phrase} exactly to enable deletion.`;});
        if (!confirm(`LAST WARNING: Delete ${s.job.entries.length} published chapters? Verify the downloaded backup first.`)) return;
      } else {
        if (!confirm(`Overwrite ${s.job.entries.length} published chapters with your local Markdown files?`)) return;
      }
      s.job.stage='apply';s.job.index=0;s.job.phase='list';s.job.status='running';
      s.note=`Applying ${s.job.mode} actions. Do not switch novels or close the tab.`;
      sessionStorage.setItem(SESSION_KEY,s.job.id);
      await putState(s);return scheduleRun(500);
    }
    if (action==='upload') {
      if (!s.files.length || s.files.some(f=>Core.chapterNumber(f.name)===null)) return amend(state=>{state.note='All file names need chapter numbers.';});
      const numbers=s.files.map(f=>Core.chapterNumber(f.name));
      if (new Set(numbers).size!==numbers.length) return amend(state=>{state.note='Duplicate chapter numbers in input files; upload refused.';});
      if (s.delivery==='schedule') {
        try {scheduleFor(s);} catch(error) {s.note=error.message;return putState(s);}
      }
      const descriptions={draft:'SAVE AS DRAFT',now:'PUBLISH NOW',schedule:'SCHEDULE using WebNovel Publish Timer'};
      if (!confirm(`${descriptions[s.delivery]}: Process ${s.files.length} chapters? Verify the book and input files first.`)) return;
      if (s.delivery==='schedule' && s.autoConfirmSchedule && !confirm('BETA: Automatically confirm timer dialogs only when native date/time fields are recognized. Test one chapter first. Continue?')) return;
      s.job=makeJob(s,'apply','upload');
      s.note=`${descriptions[s.delivery]} started. The extension will pause if a control cannot be verified.`;
      sessionStorage.setItem(SESSION_KEY,s.job.id);
      await putState(s);return scheduleRun(500);
    }
  }
  function makePanel() {
    let root = document.getElementById('inkstone-pro-root');
    if (!root) {
      root=document.createElement('section');root.id='inkstone-pro-root';
      document.documentElement.append(root);
      root.addEventListener('click', e=>{
        const btn=e.target.closest('[data-ip]');
        if(btn)handleAction(btn.getAttribute('data-ip')).catch(err=>fail(err.message));
      });
      root.addEventListener('change', async e=>{
        const target=e.target;
        try {
          if (target.id==='inkstone-pro-files') await importFiles(target);
          else if (target.name==='ip-mode') await amend(s=>{
            if(s.job?.status==='running')throw new Error('Pause first.');
            s.mode=target.value;s.job=null;s.backups=[];s.backupExported=false;
          });
          else if (target.id==='inkstone-pro-delivery') await amend(s=>{s.delivery=target.value;});
          else if (target.id==='inkstone-pro-firstdate') await amend(s=>{s.scheduleStartDate=target.value;});
          else if (target.id==='inkstone-pro-perday') await amend(s=>{s.schedulePerDay=Number(target.value);});
          else if (target.id==='inkstone-pro-times') await amend(s=>{s.scheduleTimes=target.value;});
          else if (target.id==='inkstone-pro-auto-timer') await amend(s=>{s.autoConfirmSchedule=target.checked;});
        } catch (err) {await fail(err.message);}
      });
    }
    return root;
  }
  function render(state) {
    const root=makePanel();root.classList.toggle('ip-min',minimized);
    const job=state.job;
    const entries=state.mode==='upload'?state.files:state.matches;
    const mapped=state.errors.length===0 && state.matches.length===state.files.length && state.files.length>0;
    const backupReady=job?.status==='backups-ready' && state.backups.length===job.entries.length;
    let schedule=[],scheduleError='';
    if(state.delivery==='schedule' && state.files.length) {
      try {schedule=scheduleFor(state);} catch(error) {scheduleError=error.message;}
    }
    root.innerHTML=`
      <div class="ip-brand-header">
        <div class="ip-brand-icon" aria-hidden="true"><svg viewBox="0 0 128 128" focusable="false"><rect x="2" y="2" width="124" height="124" rx="24" fill="#681D32"/><path d="M64 93 C52 85 40 83 25 85 V43 C40 40 52 43 64 51 C76 43 88 40 103 43 V85 C88 83 76 85 64 93 Z" fill="none" stroke="#EBD6AC" stroke-width="5" stroke-linejoin="round"/><path d="M64 51 V93 M36 56 C44 55 51 57 56 60 M92 56 C84 55 77 57 72 60" fill="none" stroke="#EBD6AC" stroke-width="3" stroke-linecap="round"/><path d="M97 23 L100 30 L107 33 L100 36 L97 43 L94 36 L87 33 L94 30 Z" fill="#FBECCB"/></svg></div>
        <div class="ip-brand-text"><div class="ip-overline">BRINKHAGEN SOFTWARE</div><div class="ip-title">Chapter Studio</div><div class="ip-brand-subtitle">For Inkstone <span class="ip-version">v0.3.0</span></div></div>
        <button class="ip-small ip-minimize" data-ip="min" aria-label="${minimized?'Expand':'Minimize'} Chapter Studio">${minimized?'Open':'−'}</button>
      </div>
      <div class="ip-brand-divider"></div>
      <div class="ip-tabs">${['upload','replace','delete'].map(mode=>`<button class="${state.mode===mode?'ip-tab-on':''}" name="mode-tab" data-mode="${mode}" ${job?.status==='running'?'disabled':''}>${mode==='upload'?'Upload':mode==='replace'?'Replace':'Delete'}</button>`).join('')}</div>
      <label>Markdown chapters (${state.files.length})</label>
      <input id="inkstone-pro-files" type="file" accept=".md,text/markdown" multiple ${job?.status==='running'?'disabled':''}>
      <div class="ip-list">${(state.files.length?state.files.slice(0,15).map(f=>`<div class="ip-item">${esc(f.name)}</div>`).join(''):'<div class="ip-muted">Select CH01 - Title.md, Chapter 02 - Title.md, …</div>')}${state.files.length>15?`<div class="ip-item">…and ${state.files.length-15} more</div>`:''}</div>
      ${state.mode!=='upload' ? `
        <div class="ip-actions"><button data-ip="scan" ${job?.status==='running'?'disabled':''}>① Scan visible chapter list</button></div>
        ${state.mode==='delete'?'<div class="ip-actions"><button data-ip="select-all-deletion" '+(!state.chapters.length?'disabled':'')+'>Use ALL scanned chapters as delete targets</button></div>':''}
        <div class="ip-muted">${state.chapters.length} found · ${state.matches.length} matched · ${state.errors.length} problems. Open the book’s <b>Published</b> list first.</div>
        <div class="ip-list">${state.matches.slice(0,12).map(m=>`<div class="ip-item ip-ok">#${m.number}: ${esc(m.fileName)} ↔ ${esc(m.currentTitle)}</div>`).join('')}${state.errors.slice(0,12).map(t=>`<div class="ip-item ip-error">${esc(t)}</div>`).join('')}${!state.matches.length&&!state.errors.length?'<div class="ip-muted">Scan the Published list to create an exact preview.</div>':''}</div>
        <div class="ip-actions"><button data-ip="backup" class="ip-primary" ${!mapped || job?.status==='running'?'disabled':''}>② Capture original chapters</button></div>
        <div class="ip-actions"><button data-ip="export" ${!state.backups.length?'disabled':''}>③ Download backup JSON (${state.backups.length})</button></div>
        ${state.mode==='delete'?`<label>To delete, type <b>DELETE ${job?.entries?.length||state.matches.length}</b></label><input id="inkstone-pro-delete-phrase" type="text" placeholder="Type exact confirmation">`:''}
        <div class="ip-actions"><button data-ip="apply" class="${state.mode==='delete'?'ip-danger':'ip-primary'}" ${!backupReady || !state.backupExported?'disabled':''}>④ ${state.mode==='delete'?'Delete matched chapters':'Apply replacements'}</button></div>
      `:`
        <label for="inkstone-pro-delivery">After importing chapters</label>
        <select id="inkstone-pro-delivery" ${job?.status==='running'?'disabled':''}>
          <option value="draft" ${state.delivery==='draft'?'selected':''}>Save as Draft — unpublished</option>
          <option value="now" ${state.delivery==='now'?'selected':''}>Publish Now — immediately</option>
          <option value="schedule" ${state.delivery==='schedule'?'selected':''}>Schedule — Publish Timer</option>
        </select>
        ${state.delivery==='schedule'?`
          <div class="ip-row"><div style="flex:1"><label>Start date (Berlin)</label><input type="date" id="inkstone-pro-firstdate" value="${esc(state.scheduleStartDate)}"></div><div style="width:104px"><label>Chapters/day</label><input type="number" id="inkstone-pro-perday" min="1" max="12" value="${Number(state.schedulePerDay)}"></div></div>
          <label>Release times (Berlin, comma-separated)</label>
          <input type="text" id="inkstone-pro-times" value="${esc(state.scheduleTimes)}" placeholder="08:00, 12:00, 16:00, 20:00">
          <div class="ip-muted">Enter LOCAL German date/time in Inkstone's picker. Its red label shows the GMT+8 conversion. Never enter the converted time in the picker.</div>
          ${scheduleError?`<div class="ip-banner ip-error">${esc(scheduleError)}</div>`:`<div class="ip-banner ip-ok">${schedule.length} chapters · ${Math.ceil(schedule.length/Number(state.schedulePerDay))} days</div>
          <div class="ip-list">${schedule.slice(0,8).map(p=>`<div class="ip-item">${esc(p.fileName)}<div class="ip-muted">Picker: ${esc(p.berlinDate)} ${esc(p.berlinTime)} → red GMT+8: ${esc(p.inkstoneDate)} ${esc(p.inkstoneTime)}</div></div>`).join('')}${schedule.length>8?`<div class="ip-item">… ${schedule.length-8} more</div>`:''}</div>`}
          <label><input type="checkbox" id="inkstone-pro-auto-timer" ${state.autoConfirmSchedule?'checked':''}>BETA: Auto-confirm native timer dialogs after testing</label>
          <div class="ip-actions"><button data-ip="export-schedule" ${scheduleError||!schedule.length?'disabled':''}>Download schedule CSV</button></div>
        `:''}
        <div class="ip-actions"><button data-ip="debug-editor">Debug Editor</button><button data-ip="fill">Fill first file only</button><button class="ip-primary" data-ip="upload" ${!state.files.length||!!scheduleError?'disabled':''}>Start ${state.delivery==='draft'?'Draft Import':state.delivery==='now'?'Publishing':'Scheduling'}</button></div>
        <div class="ip-muted">Tip: Start on the book's chapter overview so the extension can create the next draft after saving.</div>
      `}
      <div class="ip-banner ip-status">${esc(state.note)}</div>
      ${job?`<div class="ip-row"><span>${esc(job.mode)} · ${esc(job.stage)} · ${esc(job.status)}</span><span>${job.index}/${job.entries.length}</span></div><div class="ip-progress"><span style="width:${progress(job)}%"></span></div>`:''}
      <div class="ip-actions">${job?.status==='running'?'<button data-ip="pause">Pause</button>':job?.status==='paused'?'<button data-ip="resume">Resume</button>':''}${job?.status==='paused'&&job.mode==='upload'&&job.delivery==='schedule'&&['await-manual-confirm','publish-confirm'].includes(job.phase)?'<button data-ip="mark-next">I confirmed; next</button>':''}<button data-ip="clear">Clear local queue</button></div>
      <div class="ip-foot"><div class="ip-safety">WORKFLOW NOTE: Match unique chapter numbers and export backups before editing. Active jobs pause safely when Chrome restarts.</div><div class="ip-copyright"><span>© 2026 BRINKHAGEN · All rights reserved.</span><span>Chapter Studio v0.3.0</span></div></div>`;
    root.querySelectorAll('[name="mode-tab"]').forEach(btn=>btn.addEventListener('click',()=>amend(s=>{
      if(s.job?.status==='running')return;
      s.mode=btn.dataset.mode;s.job=null;s.backups=[];s.backupExported=false;s.note=`Selected ${s.mode} mode.`;
    })));
  }

  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local'&&changes[KEY]?.newValue)render(changes[KEY].newValue);
  });
  getState().then(s=>{
    latest=s;
    render(s);
    if(s.job?.status==='running')scheduleRun(1200);
  }).catch(err=>console.warn('BRINKHAGEN Chapter Studio initialization:',err));
  new MutationObserver(()=>{
    if(latest?.job?.status==='running' && !busy)scheduleRun(1200);
  }).observe(document.body,{childList:true,subtree:true});
})();
