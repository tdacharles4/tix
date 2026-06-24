import { vi } from 'vitest';

type CannedResponse = { data: any; error: any };

function chainable(response: CannedResponse = { data: null, error: null }) {
  const builder: any = {
    select:      () => chainable(response),
    eq:          () => chainable(response),
    neq:         () => chainable(response),
    order:       () => chainable(response),
    limit:       () => chainable(response),
    update:      () => chainable(response),
    insert:      () => chainable(response),
    delete:      () => chainable(response),
    single:      () => chainable(response),
    maybeSingle: () => chainable(response),
    then: (resolve: (v: CannedResponse) => void, reject?: (e: any) => void) =>
      Promise.resolve(response).then(resolve, reject),
  };
  return builder;
}

export function fakeSupabase(responses: {
    from?: Record<string, CannedResponse>;
    rpc?: Record<string, CannedResponse>;
}) {
return {
        from: (table: string) => chainable(responses.from?.[table]),
        rpc: vi.fn((fn: string) =>
        Promise.resolve(responses.rpc?.[fn] ?? { data: null, error: null })
        ),
};
}