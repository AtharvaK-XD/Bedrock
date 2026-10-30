// Runs workflow "code" node scripts for the parent page (src/lib/sandboxedCode.ts).
// Same semantics as the old in-page runner: new Function('input', script), objects JSON-formatted.
(function () {
  'use strict';

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) return;
    var msg = event.data;
    if (!msg || msg.type !== 'bedrock-code-run' || typeof msg.id !== 'string' || typeof msg.script !== 'string') return;

    var reply;
    try {
      var runner = new Function('input', msg.script);
      var res = runner(msg.input);
      reply = { ok: true, output: typeof res === 'object' ? JSON.stringify(res, null, 2) : String(res) };
    } catch (err) {
      reply = { ok: false, error: err && err.message ? String(err.message) : String(err) };
    }
    // The sandbox has an opaque origin, so the target origin cannot be named; replies hold only script output
    window.parent.postMessage({ type: 'bedrock-code-result', id: msg.id, ok: reply.ok, output: reply.output, error: reply.error }, '*');
  });
})();
