// Runs workflow "code" node scripts for the parent page (src/lib/sandboxedCode.ts).
// Same semantics as the old in-page runner: new Function('input', script), objects JSON-formatted.
//
// Each script runs in its own Web Worker started from this frame when the frame's CSP allows it (worker-src blob:).
// A script stuck in an endless loop then blocks only that worker: the parent removes this frame after its timeout,
// which ends the worker, and the next run starts cleanly. Without that CSP the script runs in this frame as before;
// an endless loop can then keep the sandbox busy until the page is reloaded.
(function () {
  'use strict';

  // Self-contained: its source text is also the body of the worker, so it must not use anything outside itself.
  function execute(script, input) {
    var MAX_OUTPUT_CHARS = 100000;
    var CUT_NOTE = '\n[Output cut: it was longer than 100,000 characters]';
    // Chrome/Node: "at eval (eval at execute (…code-runner.js:30:20), <anonymous>:3:7)"; Firefox: "…line 30 > Function:1:7".
    // The script's own position is the LAST match on the first stack line that has one.
    function stackLine(err) {
      if (!err || typeof err.stack !== 'string') return null;
      var rows = err.stack.split('\n');
      for (var i = 0; i < rows.length; i++) {
        var re = /(?:<anonymous>|> Function|> eval):(\d+):\d+/g;
        var m, last = null;
        while ((m = re.exec(rows[i])) !== null) last = m;
        if (last) return Number(last[1]);
      }
      return null;
    }
    // How many lines the engine adds before the script's first line (it differs between browsers): measured once.
    function lineOffset() {
      if (typeof execute.offset === 'number') return execute.offset;
      var offset = null;
      try {
        new Function('input', 'throw new Error("probe")')();
      } catch (probe) {
        var probeLine = stackLine(probe);
        if (probeLine !== null) offset = probeLine - 1;
      }
      execute.offset = offset;
      return offset;
    }

    try {
      var runner = new Function('input', script);
      var res = runner(input);
      var out = typeof res === 'object' ? JSON.stringify(res, null, 2) : String(res);
      if (out === undefined) out = 'undefined';
      if (out.length > MAX_OUTPUT_CHARS) out = out.slice(0, MAX_OUTPUT_CHARS - CUT_NOTE.length) + CUT_NOTE;
      return { ok: true, output: out };
    } catch (err) {
      var reply = { ok: false, error: err && err.message ? String(err.message) : String(err) };
      if (err && err.name && err.name !== 'Error') reply.errorName = String(err.name).slice(0, 40);
      var offset = lineOffset();
      var raw = stackLine(err);
      var lines = String(script).split('\n').length;
      if (offset !== null && raw !== null && raw - offset >= 1 && raw - offset <= lines) reply.line = raw - offset;
      return reply;
    }
  }

  var WORKER_SOURCE =
    'var execute = ' + execute.toString() + ';\n' +
    'self.window = self;\n' +
    'self.onmessage = function (e) { self.postMessage(execute(e.data.script, e.data.input)); };\n';

  var workerUrl = null;
  var workerBlocked = false; // the CSP (or the browser) does not allow a worker here: run in this frame instead
  var workerConfirmed = false;

  function startWorker() {
    if (workerBlocked || typeof Worker !== 'function' || typeof Blob !== 'function' || typeof URL === 'undefined' || !URL.createObjectURL) {
      return null;
    }
    try {
      if (!workerUrl) workerUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
      return new Worker(workerUrl);
    } catch {
      workerBlocked = true;
      return null;
    }
  }

  function send(id, reply) {
    // The sandbox has an opaque origin, so the target origin cannot be named; replies hold only script output
    window.parent.postMessage({
      type: 'bedrock-code-result', id: id, ok: reply.ok, output: reply.output, error: reply.error,
      line: reply.line, errorName: reply.errorName,
    }, '*');
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) return;
    var msg = event.data;
    if (!msg || msg.type !== 'bedrock-code-run' || typeof msg.id !== 'string' || typeof msg.script !== 'string') return;

    var worker = startWorker();
    if (!worker) {
      send(msg.id, execute(msg.script, msg.input));
      return;
    }
    var done = false;
    worker.onmessage = function (e) {
      if (done) return;
      done = true;
      workerConfirmed = true;
      worker.terminate();
      send(msg.id, e.data || { ok: false, error: 'Execution failed' });
    };
    worker.onerror = function (e) {
      if (done) return;
      done = true;
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      worker.terminate();
      if (!workerConfirmed) {
        // The worker never ran (blocked by the CSP): the script did not run either, so run it here once
        workerBlocked = true;
        send(msg.id, execute(msg.script, msg.input));
      } else {
        send(msg.id, { ok: false, error: e && e.message ? String(e.message) : 'Execution failed' });
      }
    };
    try {
      worker.postMessage({ script: msg.script, input: msg.input });
    } catch {
      done = true;
      worker.terminate();
      send(msg.id, { ok: false, error: 'This input cannot be passed to a script.' });
    }
  });
})();
