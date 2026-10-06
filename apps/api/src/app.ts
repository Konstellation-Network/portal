import { randomUUID } from 'node:crypto';
import swagger from '@fastify/swagger';
import { matchesSecret } from '@portal/adapters';
import type { Config } from '@portal/config';
import Fastify, { type FastifyError } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';

export interface AppDeps {
  config: Pick<Config, 'NODE_ENV' | 'LOG_LEVEL' | 'ORIGIN_AUTH_SECRETS'>;
  /** Throws when the database is unreachable. */
  ping: () => Promise<void>;
}

/** Every error, everywhere: { error: { code, message, request_id } }. */
export const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), request_id: z.string() }),
});

const statusSchema = z.object({ status: z.literal('ok') });

// Routes that answer without the origin header: platform health checks, and
// Pouch's webhooks (protected by their signature and an API re-check instead).
const OPEN_PATHS = ['/healthz', '/readyz'];
const OPEN_PREFIXES = ['/webhooks/'];

export async function buildApp(deps: AppDeps) {
  const app = Fastify({
    logger: deps.config.LOG_LEVEL === 'silent' ? false : { level: deps.config.LOG_LEVEL },
    // Never trust a client-supplied request id.
    requestIdHeader: false,
    genReqId: () => randomUUID(),
    bodyLimit: 16 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'Portal API', version: '1' },
    },
    transform: jsonSchemaTransform,
  });

  const fail = (code: string, message: string, requestId: string) => ({
    error: { code, message, request_id: requestId },
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
    const secrets = deps.config.ORIGIN_AUTH_SECRETS;
    if (secrets.length === 0) return;
    const path = request.url.split('?')[0] ?? '';
    if (OPEN_PATHS.includes(path) || OPEN_PREFIXES.some((p) => path.startsWith(p))) return;
    const given = request.headers['x-origin-auth'];
    if (!matchesSecret(Array.isArray(given) ? given[0] : given, secrets)) {
      return reply
        .code(403)
        .send(fail('forbidden', 'Requests must come through Portal.', request.id));
    }
  });

  app.setErrorHandler<FastifyError>((err, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.code(400).send(fail('invalid_request', 'The request is not valid.', request.id));
    }
    const status = err.statusCode ?? 500;
    if (status >= 500) request.log.error(err);
    const message = status >= 500 ? 'Something went wrong.' : err.message;
    return reply.code(status).send(fail(err.code ?? 'error', message, request.id));
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send(fail('not_found', 'No such route.', request.id)),
  );

  app.get('/healthz', { schema: { response: { 200: statusSchema } } }, async () => ({
    status: 'ok' as const,
  }));

  app.get(
    '/readyz',
    { schema: { hide: true, response: { 200: statusSchema, 503: errorSchema } } },
    async (request, reply) => {
      try {
        await deps.ping();
        return { status: 'ok' as const };
      } catch (err) {
        request.log.warn({ err }, 'database unreachable');
        return reply.code(503).send(fail('unavailable', 'Database unreachable.', request.id));
      }
    },
  );

  // The SDK is generated from this spec; production does not serve it.
  if (deps.config.NODE_ENV !== 'production') {
    app.get('/v1/openapi.json', { schema: { hide: true } }, async () => app.swagger());
  }

  return app;
}
