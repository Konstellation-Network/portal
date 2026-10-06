// Cloudflare Pages Function: forwards /api/* to the API with the prefix removed.
//
// Until there is a domain (STATUS P34) this is how the web app reaches the API:
// the browser only ever talks to the app's own pages.dev address, so the
// refresh cookie stays first-party, and this Function adds the origin secret
// the API requires. With a domain, a Cloudflare Transform Rule takes its place.
//
// Pages project variables: API_ORIGIN (e.g. https://api-xxxx.run.app) and the
// secret ORIGIN_AUTH_SECRET.

interface Env {
  API_ORIGIN: string;
  ORIGIN_AUTH_SECRET: string;
}

interface Context {
  request: Request;
  env: Env;
}

export const onRequest = async ({ request, env }: Context): Promise<Response> => {
  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname.replace(/^\/api/, '') + incoming.search, env.API_ORIGIN);
  const forwarded = new Request(target.toString(), request);
  // Overwrite anything the client sent in these headers.
  forwarded.headers.set('x-origin-auth', env.ORIGIN_AUTH_SECRET);
  forwarded.headers.set('x-forwarded-for', request.headers.get('cf-connecting-ip') ?? '');
  return fetch(forwarded);
};
