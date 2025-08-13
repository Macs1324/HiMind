import { Hono } from 'hono';
import type { AppContext } from '@infra/app_context';


export function createHonoServer(ctx: AppContext) {
  const app = new Hono();

  // Simple request logger middleware
  app.use('*', async (c, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.logger.info({ method: c.req.method, path: c.req.path, status: c.res.status, ms }, 'http');
  });

  app.get('/health', c => c.json({ ok: true }));

  app.onError((err, c) => {
    ctx.logger.error({ err }, 'unhandled');
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}


