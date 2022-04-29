import { inject, Injectable } from "@angular/core";
import { collection, doc, DocumentData, DocumentSnapshot, query, queryEqual, QuerySnapshot, runTransaction, writeBatch } from 'firebase/firestore';
import type { Transaction, CollectionReference, DocumentReference, Query, QueryConstraint } from 'firebase/firestore';
import { FIRESTORE } from "../firestore";
import { assertCollection, assertPath, isDocPath, isQuery } from "../utils";
import { Observable } from "rxjs";
import { fromRef, shareWithDelay } from "../operators";

type Reference<E> = CollectionReference<E> | DocumentReference<E>;
type Snapshot<E = DocumentData> = DocumentSnapshot<E> | QuerySnapshot<E>;

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private memoryQuery: Map<Query, Observable<QuerySnapshot>> = new Map();
  private memoryRef: Record<string, Observable<Snapshot>> = {};
  private getFirestore = inject(FIRESTORE);

  get db() {
    return this.getFirestore();
  }

  /** @internal Should only be used by FireCollection services */
  fromMemory<E>(ref: DocumentReference<E> | CollectionReference<E> | Query<E>): Observable<Snapshot<E>> {
    if (isQuery(ref)) {
      let existing: Observable<QuerySnapshot<E>> | null = null;
      for (const [key, value] of this.memoryQuery.entries()) {
        if (typeof key !== 'string' && queryEqual(key, ref)) {
          existing = value as Observable<QuerySnapshot<E>>;
          break;
        }
      }
      if (existing) return existing;
      this.memoryQuery.set(ref, fromRef(ref).pipe(shareWithDelay()));
      return this.memoryQuery.get(ref) as Observable<QuerySnapshot<E>>;
    } else {
      const path = ref.path;
      if (this.memoryRef[path]) return this.memoryRef[path] as Observable<Snapshot<E>>;
      this.memoryRef[path] = fromRef(ref).pipe(shareWithDelay());
      return this.memoryRef[path] as Observable<Snapshot<E>>;
    }
  }

  clearCache(path: string | string[] | Query) {
    if (!path) return;
    if (Array.isArray(path)) {
      path.forEach(path => delete this.memoryRef[path]);
    } else if (typeof path === 'string') {
      delete this.memoryRef[path];
    } else {
      this.memoryQuery.delete(path);
    }
  }

  /** Get the reference of the document, collection or query */
  public getRef<E>(path: string): Reference<E>;
  public getRef<E>(paths: string[]): DocumentReference<E>[];
  public getRef<E>(path: string, constraints: QueryConstraint[]): Query<E>;
  // overload used internally when looping over paths array
  public getRef<E>(
    paths: string | string[],
    constraints?: QueryConstraint[],
  ): undefined | Query<E> | Query<E>[] | Reference<E> | DocumentReference<E>[] {
    if (!arguments.length || !paths) return undefined;

    // Array of docs
    if (Array.isArray(paths)) {
      return paths.map((path) => this.getRef<E>(path) as DocumentReference<E>);
    }
    
    const hasContraints = Array.isArray(constraints);
    if (hasContraints) {
      assertPath(paths);
      assertCollection(paths);
      const ref = collection(this.db, paths) as CollectionReference<E>;
      return query(ref, ...constraints);
    } else {
      assertPath(paths);
      if (isDocPath(paths)) return doc(this.db, paths) as DocumentReference<E>;
      return collection(this.db, paths) as CollectionReference<E>;
    }
  }

  batch() {
    return writeBatch(this.db);
  }

  runTransaction<T>(cb: (transaction: Transaction) => Promise<T>) {
    return runTransaction<T>(this.db, (tx) => cb(tx));
  }

  createId() {
    return doc(collection(this.db, '__')).id;
  }

}