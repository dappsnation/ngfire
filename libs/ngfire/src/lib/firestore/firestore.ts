import { inject, Injectable, InjectFlags, Injector, PLATFORM_ID } from "@angular/core";
import { collection, doc, DocumentData, DocumentSnapshot, query, queryEqual, QuerySnapshot, runTransaction, writeBatch } from 'firebase/firestore';
import type { Transaction, CollectionReference, DocumentReference, Query, QueryConstraint } from 'firebase/firestore';
import { FIRESTORE } from "./tokens";
import { assertCollection, assertPath, isDocPath, isQuery } from "../utils";
import { Observable } from "rxjs";
import { fromRef, shareWithDelay } from "../operators";
import { makeStateKey, TransferState } from "@angular/platform-browser";
import { isPlatformBrowser, isPlatformServer } from "@angular/common";

type Reference<E> = CollectionReference<E> | DocumentReference<E>;
type Snapshot<E = DocumentData> = DocumentSnapshot<E> | QuerySnapshot<E>;

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private memoryQuery: Map<Query, Observable<QuerySnapshot>> = new Map();
  private memoryRef: Record<string, Observable<Snapshot>> = {};
  private injector = inject(Injector);
  private plateformId = inject(PLATFORM_ID);
  /** Transfer state between server and  */
  private transferState = inject(TransferState, InjectFlags.Optional);
  /** Cache based state for document */
  private state: Record<string, any> = {};

  get db() {
    return this.injector.get(FIRESTORE);
  }

  /** @internal Should only be used by FireCollection services */
  setState<E>(ref: DocumentReference<E> | CollectionReference<E> | Query<E>, value: E | E[]) {
    if (isQuery(ref)) return;
    this.state[ref.path] = value;
  }

  getState<E>(ref: DocumentReference<E> | CollectionReference<E> | Query<E>): E | E[] | undefined {
    if (isQuery(ref)) return;
    return this.state[ref.path];
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
      const observable = fromRef(ref).pipe(shareWithDelay());
      this.memoryQuery.set(ref, observable);
      return this.memoryQuery.get(ref) as Observable<QuerySnapshot<E>>;
    } else {
      const path = ref.path;
      if (!this.memoryRef[path]) {
        this.memoryRef[path] = fromRef(ref).pipe(shareWithDelay());
      }
      return this.memoryRef[path] as Observable<Snapshot<E>>;
    }
  }

  /**
   * @internal Should only be used by FireCollection services
   * Get the transfer state for a specific ref and put it in the memory state
   * Remove the reference to transfer state after first call
   */
  getTransfer<E>(ref: DocumentReference<E>): E | undefined
  getTransfer<E>(ref: CollectionReference<E> | Query<E>): E[] | undefined
  getTransfer<E>(ref: DocumentReference<E> | CollectionReference<E> | Query<E>): E[] | E | undefined
  getTransfer<E>(ref: DocumentReference<E> | CollectionReference<E> | Query<E>) {
    if (!this.transferState || !isPlatformBrowser(this.plateformId)) return;
    if (isQuery(ref)) return;
    const key = makeStateKey<E>(ref.path);
    if (!this.transferState.hasKey(key)) return;
    const value = this.transferState.get(key, undefined);
    this.transferState.remove(key);
    return value;
  }

  /** @internal Should only be used by FireCollection services */
  setTransfer<E>(ref: DocumentReference<E>, value?: E): void
  setTransfer<E>(ref: DocumentReference<E>[] | CollectionReference<E> | Query<E>, value?: E[]): void
  setTransfer<E>(ref: DocumentReference<E> | DocumentReference<E>[] | CollectionReference<E> | Query<E>, value?: E | E[]): void
  setTransfer<E>(ref: DocumentReference<E> | DocumentReference<E>[] | CollectionReference<E> | Query<E>, value?: E | E[]) {
    if (!value) return;
    if (!this.transferState || !isPlatformServer(this.plateformId)) return;
    if (Array.isArray(ref) && Array.isArray(value)) {
      ref.forEach((reference, i) => this.setTransfer(reference, value[i]));
    } else if (!Array.isArray(ref)) {
      if (isQuery(ref)) return;
      this.transferState.set(makeStateKey<E>(ref.path), value);
    }
  }


  clearCache(paths: string | string[] | Query) {
    if (!paths) return;
    if (Array.isArray(paths)) {
      for (const path of paths) {
        delete this.memoryRef[path];
        delete this.state[path];
      }
    } else if (typeof paths === 'string') {
      delete this.memoryRef[paths];
      delete this.state[paths];
    } else {
      this.memoryQuery.delete(paths);
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