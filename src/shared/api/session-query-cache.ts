import type { QueryClient, MutationObserver } from '@tanstack/react-query'

import { captureSessionScope, type SessionScope } from './session'
import { isPublicAppQuery } from './persist-policy'

const bound = new WeakSet<QueryClient>()

/** Bind at intent creation, before onMutate, an offline pause or any retry. */
export function bindSessionCaches(client: QueryClient): void {
  if (bound.has(client)) return
  bound.add(client)
  const cancellations = new Map<object, { scope: SessionScope; abort: () => void }>()
  const watchLifetime = () => {
    const scope = captureSessionScope()
    scope.signal.addEventListener('abort', () => {
      watchLifetime()
      // Stop old requests, retaining the last public snapshot and its observers.
      // Startup checks the administrative version once per app lifetime.
      for (const query of client.getQueryCache().getAll()) {
        if (isPublicAppQuery(query.queryKey)) void query.cancel({ silent: true })
      }
      for (const [owner, work] of cancellations) {
        if (!work.scope.signal.aborted) continue
        cancellations.delete(owner)
        work.abort()
      }
    }, { once: true })
  }
  watchLifetime()
  const mutations = client.getMutationCache()
  const observers = new WeakMap<object, Set<MutationObserver>>()
  mutations.subscribe(event => {
    if (event.type === 'observerAdded') {
      observers.get(event.mutation)?.add(event.observer)
      return
    }
    if (event.type === 'observerRemoved') {
      observers.get(event.mutation)?.delete(event.observer)
      if (event.mutation.state.status !== 'pending' && !observers.get(event.mutation)?.size
        && !mutations.getAll().includes(event.mutation)) cancellations.delete(event.mutation)
      return
    }
    if (event.type === 'removed' && event.mutation.state.status !== 'pending'
      && !observers.get(event.mutation)?.size) cancellations.delete(event.mutation)
    if (event.type !== 'added') return
    const mutation = event.mutation
    const scope = captureSessionScope()
    const attached = new Set<MutationObserver>()
    observers.set(mutation, attached)
    const setOptions = mutation.setOptions.bind(mutation)
    mutation.setOptions = options => {
      const retry = options.retry
      setOptions({
        ...options,
        mutationFn: (...args) => {
          scope.assert()
          if (!options.mutationFn) throw new Error('No mutationFn found')
          return scope.wait(options.mutationFn(...args))
        },
        onMutate: (...args) => {
          scope.assert()
          return scope.wait(options.onMutate?.(...args))
        },
        retry: (count, error) => !scope.signal.aborted && (
          typeof retry === 'function' ? retry(count, error) : retry === true || count < (retry || 0)
        ),
        onSuccess: (...args) => scope.signal.aborted ? undefined : scope.wait(options.onSuccess?.(...args)),
        onError: (...args) => scope.signal.aborted ? undefined : scope.wait(options.onError?.(...args)).catch(error => {
          if (!scope.signal.aborted) throw error
        }),
        onSettled: (...args) => scope.signal.aborted ? undefined : scope.wait(options.onSettled?.(...args)).catch(error => {
          if (!scope.signal.aborted) throw error
        }),
      })
    }
    mutation.setOptions(mutation.options)
    const execute = mutation.execute.bind(mutation)
    mutation.execute = async variables => {
      scope.assert()
      return scope.wait(execute(variables))
    }
    const abort = () => {
      // Clearing the cache alone does not stop a retryer's captured function.
      // Remove observers too: their per-invocation callbacks belong to A.
      for (const observer of attached) observer.reset()
      mutations.remove(mutation)
    }
    cancellations.set(mutation, { scope, abort })
  })

  const queries = client.getQueryCache()
  queries.subscribe(event => {
    if (event.type === 'removed') cancellations.delete(event.query)
    if (event.type !== 'added') return
    const query = event.query
    // Public queries may fetch again in any session; never bind their fetch
    // function to the account that happened to create the cache entry.
    if (isPublicAppQuery(query.queryKey)) return
    const scope = captureSessionScope()
    const fetch = query.fetch.bind(query)
    query.fetch = async (options, fetchOptions) => {
      scope.assert()
      const source = options ?? query.options
      const queryFn = source.queryFn
      return fetch({
        ...source,
        queryFn: typeof queryFn === 'function' ? context => {
          scope.assert()
          return scope.wait(queryFn(context))
        } : queryFn,
      }, fetchOptions)
    }
    cancellations.set(query, { scope, abort: () => {
      void query.cancel({ silent: true })
      queries.remove(query)
    } })
  })
}
