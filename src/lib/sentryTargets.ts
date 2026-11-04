// Sentry adds its tracing headers (sentry-trace, baggage) to outgoing requests whose URL matches one of these
// targets. A plain string matches when the URL merely CONTAINS it, and the old list had 'localhost' (which also
// matched a local Ollama at http://localhost:11434) and every *.vercel.app site. Other services should not
// receive Bedrock's trace ids: keep it to Bedrock's own API.
export function tracePropagationTargets(ownOrigin?: string): Array<string | RegExp> {
  return [
    /^\//, // relative URLs: Bedrock's own /api routes on whatever address the app is served from
    /^https:\/\/bedrock-steel\.vercel\.app(\/|$)/,
    // Absolute URLs back to this same page origin (the desktop app's own 127.0.0.1:<port>, a preview deployment)
    ...(ownOrigin && /^https?:\/\//.test(ownOrigin) ? [new RegExp(`^${ownOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/|$)`)] : []),
  ];
}
