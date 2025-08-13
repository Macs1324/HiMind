# Architecture (minimal)

## Directories
- `core`: domain contracts and use-cases
- `infra`: wiring, logger, HTTP server, adapters
- `src/index.ts`: server bootstrap

## Flow
- HTTP request → `infra/http/honoServer.ts`
- Use-case → `core/*`
- Data access → `infra/adapters/*`
- Wiring → `infra/app_context.ts`
