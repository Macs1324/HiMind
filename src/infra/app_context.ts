import { createLogger } from '@infra/logger';
import type { Ports } from '@core/contracts';
import { makeAnswersRepository, makeQuestionsRepository } from './adapters/memory_repos';


export type AppContext = {
  logger: ReturnType<typeof createLogger>;
  ports: Ports;

};

export function makeAppContext(): AppContext {
  const logger = createLogger();
  const ports: Ports = {
    questions: makeQuestionsRepository(),
    answers: makeAnswersRepository(),
  };
  return { logger, ports };
}


