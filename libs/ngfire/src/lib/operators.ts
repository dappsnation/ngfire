import {
  combineLatest,
  MonoTypeOperatorFunction,
  Observable,
  OperatorFunction,
  ReplaySubject,
  Subscriber,
  Subscription,
  of,
  from,
} from 'rxjs';
import { debounceTime, map, startWith, switchMap, tap } from 'rxjs/operators';

import { onSnapshot, DocumentReference, DocumentData, SnapshotListenOptions, Query, DocumentSnapshot, QuerySnapshot } from 'firebase/firestore';
import { Auth, User, onIdTokenChanged } from 'firebase/auth';

const DEFAULT_OPTIONS = { includeMetadataChanges: false };
export function fromRef<T=DocumentData>(ref: DocumentReference<T>, options?: SnapshotListenOptions): Observable<DocumentSnapshot<T>>;
export function fromRef<T=DocumentData>(ref: Query<T>, options?: SnapshotListenOptions): Observable<QuerySnapshot<T>>;
export function fromRef<T=DocumentData>(
  ref: any,
  options: SnapshotListenOptions = DEFAULT_OPTIONS
): Observable<any> {
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return new Observable(subscriber => {
    const unsubscribe = onSnapshot<T>(ref, options, {
      next: subscriber.next.bind(subscriber), 
      error: subscriber.error.bind(subscriber), 
      complete: subscriber.complete.bind(subscriber),
    });
    return { unsubscribe };
  });
}


export function user(auth: Auth): Observable<User|null> {
  return new Observable(subscriber => {
    const unsubscribe = onIdTokenChanged(
      auth, 
      subscriber.next.bind(subscriber), 
      subscriber.error.bind(subscriber), 
      subscriber.complete.bind(subscriber),
    );
    return { unsubscribe };
  });
}


/**
 * Replay the data and share it across source.
 * It will unsubscribe after a delay when there is no more subscriber
 * This is useful if you unsubscribe from a page & resubscribe on the other
 * @note code based on shareReplay of rxjs v6.6.7: https://github.com/ReactiveX/rxjs/blob/6.6.7/src/internal/operators/shareReplay.ts
 * @param delay Delay in ms to wait before unsubscribing
 */
export function shareWithDelay<T>(delay: number = 100): MonoTypeOperatorFunction<T> {
  let subject: ReplaySubject<T> | undefined;
  let subscription: Subscription | undefined;
  let refCount = 0;
  let hasError = false;
  let isComplete = false;
  let lastValue: T;
  function operation(this: Subscriber<T>, source: Observable<T>) {
    refCount++;
    let innerSub: Subscription | undefined;
    if (!subject || hasError) {
      hasError = false;
      subject = new ReplaySubject<T>(1, Infinity);
      if (lastValue) subject.next(lastValue);
      innerSub = subject.subscribe(this);
      subscription = source.subscribe({
        next(value) {
          subject?.next(value);
          lastValue = value;
        },
        error(err) {
          hasError = true;
          subject?.error(err);
        },
        complete() {
          isComplete = true;
          subscription = undefined;
          subject?.complete();
        }
      });

      // Here we need to check to see if the source synchronously completed. Although
      // we're setting `subscription = undefined` in the completion handler, if the source
      // is synchronous, that will happen *before* subscription is set by the return of
      // the `subscribe` call.
      if (isComplete) {
        subscription = undefined;
      }
    } else {
      innerSub = subject.subscribe(this);
    }

    this.add(() => {
      refCount--;
      innerSub?.unsubscribe();
      innerSub = undefined;

      // await some ms before unsubscribing
      setTimeout(() => {
        if (subscription && !isComplete && refCount === 0) {
          subscription.unsubscribe();
          subscription = undefined;
          subject = undefined;
        }
      }, delay);
    });
  }

  return (source: Observable<T>) => source.lift(operation);
}




type QueryMap<T> = Record<string, (data: Entity<T>) => any>
type Entity<T> = T extends Array<infer I> ? I : T;
type GetSnapshot<F extends (...data: any) => any> = 
  F extends (...data: any) => Observable<infer I> ? I
  : F extends (...data: any) => Promise<infer J> ? J
  : ReturnType<F>;
type Join<T, Query extends QueryMap<T>> = T & { [key in keyof Query]?: GetSnapshot<Query[key]> };
type Jointure<T, Query extends QueryMap<any>> = T extends Array<infer I>
  ? Join<I, Query>[]
  : Join<T, Query>;

interface JoinWithOptions {
  /** If set to false, the subqueries will be filled with undefined and hydrated as they come through */
  shouldAwait?: boolean;
  /** Used to not trigger change detection too often */
  debounceTime?: number;
}

/**
 * Operator that join the source with sub queries.
 * There are two stategies : 
 * 1. `shouldAwait: true`: Await all subqueries to emit once before emitting a next value
 * 2. `shouldAwait: false`: Emit the source and hydrate it with the subqueries along the way
 * @example
 * ```typescript
 * of({ docUrl: '...' }).valueChanges().pipe(
 *   joinWith({
 *     doc: source => fetch(docUrl).then(res => res.json()),
 *   }, { shouldAwait: true })
 * ).subscribe(res => console.log(res.subQuery))
 * ```
 * @param queries A map of subqueries to apply. Each query can return a static value, Promise or Observable
 * @param options Strategy to apply on the joinWith
 */
export function joinWith<T, Query extends QueryMap<T>>(queries: Query, options: JoinWithOptions = {}): OperatorFunction<T, Jointure<T, Query>> {
  const shouldAwait = options.shouldAwait ?? true;
  const debounce = options.debounceTime ?? 100;
  const runQuery = (entity: Entity<T>) => {
    const obs = [];
    for (const key in queries) {
      // Transform return value into an observable
      let result: any = queries[key](entity);
      if (!(result instanceof Observable)) {
        if (result instanceof Promise) {
          result = from(result);
        } else {
          result = of(result);
        }
      }
      // Hydrate the entity with the data
      let observe: Observable<any>;
      if (shouldAwait) {
        observe = result.pipe(
          tap(result => (entity as any)[key] = result),
        );
      } else {
        observe = result.pipe(
          startWith(undefined),
          tap(result => (entity as any)[key] = result),
        );
      }
      obs.push(observe);
    }
    if (!obs.length) return of(entity);
    return combineLatest(obs).pipe(
      map(() => {
        if (!entity) return entity;
        return JSON.parse(JSON.stringify(entity), jsonDateReviver) as any;
      }),
    );
  }

  return switchMap((data: T) => {
    if (Array.isArray(data)) {
      if (!data.length) return of([]);
      return combineLatest(data.map(runQuery));
    }
    return runQuery(data as Entity<T>).pipe(debounceTime(debounce));
  });
}

function jsonDateReviver(_: unknown, value: any) {
  if (!value) return value;

  const dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,}|)Z$/;
  if (typeof value === 'string' && dateFormat.test(value)) return new Date(value);
  if (
    typeof value === 'object' &&
    Object.keys(value).length === 2 &&
    ['nanoseconds', 'seconds'].every((k) => k in value)
  )
    return new Date(((value.nanoseconds * 1) ^ -6) + value.seconds * 1000);

  return value;
}
