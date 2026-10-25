/* BRINKHAGEN Chapter Studio — narrow TinyMCE bridge in the page's MAIN world.
 * It can only set the active chapter editor body; it never saves or publishes.
 */
(() => {
  'use strict';
  if (window.__brinkhagenTinyBridgeV1) return;
  window.__brinkhagenTinyBridgeV1 = true;

  const REQUEST = 'brinkhagen:tinymce:set';
  const RESPONSE = 'brinkhagen:tinymce:result';
  const escape = value => String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));
  const paragraphs = value => String(value).split(/\n\n+/)
    .map(part=>`<p>${part.split('\n').map(escape).join('<br>')}</p>`).join('');
  const comparable = text => String(text || '').replace(/\s+/g,' ').trim();

  function chapterEditor() {
    const tinymce = window.tinymce;
    if (!tinymce) return null;
    const editors = Array.from(tinymce.editors || []).filter(editor => {
      try {
        return editor.initialized !== false && !editor.removed && !!editor.getBody?.();
      } catch { return false; }
    });
    // Never choose an arbitrary editor if several TinyMCE instances are active.
    return editors.length === 1 ? editors[0] : null;
  }

  document.addEventListener(REQUEST, event => {
    let id;
    try {
      const request = JSON.parse(event.detail);
      if (!request || typeof request.id !== 'string' || typeof request.text !== 'string') return;
      id = request.id;
      const editor = chapterEditor();
      if (!editor) throw new Error('No unique initialized TinyMCE editor.');
      if (request.text.length > 500000) throw new Error('Chapter is too long for a single editor write.');
      editor.setContent(paragraphs(request.text), {format:'html'});
      editor.setDirty?.(true);
      editor.fire?.('input');
      editor.fire?.('change');
      editor.save?.();
      if (comparable(editor.getBody().innerText) !== comparable(request.text)) {
        throw new Error('TinyMCE body did not retain the expected text.');
      }
      document.dispatchEvent(new CustomEvent(RESPONSE, {detail:JSON.stringify({id,ok:true})}));
    } catch (error) {
      if (id) document.dispatchEvent(new CustomEvent(RESPONSE, {
        detail:JSON.stringify({id,ok:false,error:error?.message||String(error)})
      }));
    }
  });
})();
