import type { DocumentData, DocumentReference, DocumentSnapshot, Query, QuerySnapshot, SnapshotListenOptions } from "firebase/firestore";
import { onSnapshot } from 'firebase/firestore';
import { Observable } from "rxjs";

const DEFAULT_OPTIONS = { includeMetadataChanges: false };
export function fromRef<T=DocumentData>(ref: DocumentReference<T>, options?: SnapshotListenOptions): Observable<DocumentSnapshot<T>>;
export function fromRef<T=DocumentData>(ref: Query<T>, options?: SnapshotListenOptions): Observable<QuerySnapshot<T>>;
export function fromRef<T=DocumentData>(
  ref: DocumentReference<T> | Query<T>,
  options: SnapshotListenOptions
): Observable<DocumentSnapshot<T>> | Observable<QuerySnapshot<T>>;
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