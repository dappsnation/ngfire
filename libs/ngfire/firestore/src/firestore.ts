import { inject, Injectable, InjectFlags, Injector, PLATFORM_ID, makeStateKey, TransferState } from "@angular/core";
import { collection, doc, DocumentData, DocumentSnapshot, query, queryEqual, QuerySnapshot, runTransaction, writeBatch } from 'firebase/firestore';
import type { Transaction, CollectionReference, DocumentReference, Query, QueryConstraint } from 'firebase/firestore';
import { FIRESTORE } from "./tokens";
import { shareWithDelay, assertCollection, assertPath, isCollectionRef, isDocPath, isQuery } from "ngfire/core";
import { fromRef } from "./operators";
import { isPlatformBrowser, isPlatformServer } from "@angular/common";
import { Observable } from "rxjs";
import { stringifyQuery } from "./query";

type Reference<E> = CollectionReference<E> | DocumentReference<E>;
type Snapshot<E = DocumentData> = DocumentSnapshot<E> | QuerySnapshot<E>;

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private memoryRef: Record<string, Observable<Snapshot>> = {};
  private injector = inject(Injector);
  private plateformId = inject(PLATFORM_ID);
  /** Transfer state between server and  */
  private transferState = inject(TransferState, InjectFlags.Optional);
  /** Cache based state for document */
  private state: Map<string | Query, Snapshot<unknown>> = new Map();

  get db() {
    return this.injector.get(FIRESTORE);
  }

  /** @internal Should only be used by FireCollection services */
  setState<E>(
    ref: DocumentReference<E> | CollectionReference<E> | Query<E>,
    snap: Snapshot<E>
  ) {
    if (isCollectionRef(ref)) {
      (snap as QuerySnapshot<E>).forEach(doc => this.state.set(doc.ref.path, doc));
      this.state.set(ref.path, snap);
    } else if (isQuery(ref)) {
      (snap as QuerySnapshot<E>).forEach(doc => this.state.set(doc.ref.path, doc));
      const key = stringifyQuery(ref);
      this.state.set(key, snap);
    } else {
      this.state.set(ref.path, snap);
    }
  }

  getState<E>(ref: DocumentReference<E>, delay?: number): DocumentSnapshot<E>
  getState<E>(ref: CollectionReference<E>, delay?: number): QuerySnapshot<E>
  getState<E>(ref: Query<E>, delay?: number): QuerySnapshot<E>
  getState<E>(ref: DocumentReference<E> | CollectionReference<E> | Query<E>): Snapshot<E> | undefined
  getState<E>(ref: DocumentReference<E> | CollectionReference<E> | Query<E>): Snapshot<E> | undefined {
    if (isQuery(ref)) {
      const key = stringifyQuery(ref);
      return this.state.get(key) as Snapshot<E>;
    } else {
      return this.state.get(ref.path) as Snapshot<E>;
    }
  }

  /** @internal Should only be used by FireCollection services */
  fromMemory<E>(ref: DocumentReference<E>, delay?: number): Observable<DocumentSnapshot<E>>
  fromMemory<E>(ref: CollectionReference<E>, delay?: number): Observable<QuerySnapshot<E>>
  fromMemory<E>(ref: Query<E>, delay?: number): Observable<QuerySnapshot<E>>
  fromMemory<E>(ref: DocumentReference<E> | CollectionReference<E> | Query<E>, delay?: number): Observable<Snapshot<E>>
  fromMemory<E>(
    ref: DocumentReference<E> | CollectionReference<E> | Query<E>,
    delay?: number
  ): Observable<Snapshot<E>> {
    const key = isQuery(ref) ? stringifyQuery(ref) : ref.path;
    if (!this.memoryRef[key]) {
      this.memoryRef[key] = fromRef(ref as any).pipe(shareWithDelay(delay));
    }
    return this.memoryRef[key] as Observable<Snapshot<E>>;
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
    const key = isQuery(ref) ? stringifyQuery(ref) : ref.path;
    const stateKey = makeStateKey<E>(key);
    if (!this.transferState.hasKey(stateKey)) return;
    const value = this.transferState.get(stateKey, undefined);
    this.transferState.remove(stateKey);
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
      const key = isQuery(ref) ? stringifyQuery(ref) : ref.path;
      this.transferState.set(makeStateKey<E>(key), value);
    }
  }


  clearCache(paths: string | string[] | Query) {
    if (!paths) return;
    if (Array.isArray(paths)) {
      for (const path of paths) {
        delete this.memoryRef[path];
        this.state.delete(path);
      }
    } else if (typeof paths === 'string') {
      delete this.memoryRef[paths];
      this.state.delete(paths);
    } else {
      const key = stringifyQuery(paths);
      delete this.memoryRef[key];
      this.state.delete(key);
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