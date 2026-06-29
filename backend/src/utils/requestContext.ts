import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContextStore = {
  correlationId: string;
};

const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext<T>(
  store: RequestContextStore,
  callback: () => T,
): T {
  return requestContext.run(store, callback);
}

export function getCorrelationId(): string | undefined {
  return requestContext.getStore()?.correlationId;
}
