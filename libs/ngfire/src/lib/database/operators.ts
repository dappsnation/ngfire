import {Observable} from 'rxjs';
import {delay} from 'rxjs/operators';
import {DataSnapshot, onValue} from 'firebase/database';
import type {Query} from 'firebase/database';

/**
 * Create an observable from a Database Reference or Database Query.
 * @param query Database Reference
 */
export function fromQuery(query: Query): Observable<DataSnapshot> {
  return new Observable<DataSnapshot>((subscriber) => {
    const unsubscribe = onValue(
      query,
      (snapshot) => subscriber.next(snapshot),
      subscriber.error.bind(subscriber),
    );
    return { unsubscribe };
  }).pipe(
      // Ensures subscribe on observable is async. This handles
      // a quirk in the SDK where on/once callbacks can happen
      // synchronously.
      delay(0)
  );
}