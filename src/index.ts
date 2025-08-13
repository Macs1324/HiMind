import 'dotenv/config';
import { makeAppContext } from '@infra/app_context';
import { createHonoServer } from '@infra/http/honoServer';
import { serve } from '@hono/node-server';

const appCtx = makeAppContext();
const app = createHonoServer(appCtx);
serve({ fetch: app.fetch, port: 3000 });
appCtx.logger.info('HTTP listening on :3000');


