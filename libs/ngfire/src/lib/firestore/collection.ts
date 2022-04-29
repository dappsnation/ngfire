/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { inject, NgZone, PLATFORM_ID } from '@angular/core';
import { Observable, of, combineLatest, from } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { FIRESTORE } from '../firestore';
import { writeBatch, runTransaction, doc, collection, Query, getDocs, getDoc, Timestamp, Transaction, DocumentSnapshot, FieldValue } from 'firebase/firestore';
import type { DocumentData, CollectionReference, DocumentReference, QueryConstraint, QueryDocumentSnapshot, QuerySnapshot, WriteBatch } from 'firebase/firestore';
import { fromRef } from '../operators';
import { WriteOptions, UpdateCallback, MetaDocument, Params, FireEntity, DeepKeys } from '../types';
import { isIdList, isNotUndefined, isPathRef, isQuery, pathWithParams } from '../utils';

import { isPlatformServer } from '@angular/common';
import { keepUnstableUntilFirst } from '../zone';
import { FirestoreService } from './firestore';

/////////////
// HELPERS //
/////////////

/** Return the full path of the doc */
export function getDocPath(path: string, id: string) {
  // If path is smaller than id, id is the full path from ref
  return path.split('/').length < id.split('/').length ? id : `${path}/${id}`;
}

/** Recursively all Timestamp into Date */
export function toDate<D>(target: D): D {
  if (typeof target !== 'object') return target;
  for (const key in target) {
    const value = target[key];
    if (!value || typeof value !== 'object') continue;
    if (value instanceof Timestamp) {
      target[key] = value.toDate() as any;
      continue;
    }
    toDate(value)
  }
  return target;
}


/////////////
// SERVICE //
/////////////

export abstract class FireCollection<E extends DocumentData> {
  private getFirestore = inject(FIRESTORE);
  private platformId = inject(PLATFORM_ID);
  private zone = inject(NgZone);
  private firestore = inject(FirestoreService);
  protected abstract readonly path: string;
  protected idKey: DeepKeys<E> = 'id' as any;
  // If true, will store the document id (IdKey) onto the document
  protected storeId = false;
  protected memorize = false;

  protected onCreate?(entity: E, options: WriteOptions): any;
  protected onUpdate?(entity: FireEntity<E>, options: WriteOptions): any;
  protected onDelete?(id: string, options: WriteOptions): any;


  protected get db() {
    return this.getFirestore();
  }

  protected useCache(ref: DocumentReference<E>): Observable<DocumentSnapshot<E>>
  protected useCache(ref: Query<E>): Observable<QuerySnapshot<E>>
  protected useCache(ref: DocumentReference<E> | Query<E>): Observable<DocumentSnapshot<E> | QuerySnapshot<E>>   
  protected useCache(ref: DocumentReference<E> | Query<E>): Observable<DocumentSnapshot<E> | QuerySnapshot<E>> {    
    if (!this.memorize) return isQuery(ref) ? fromRef(ref) : fromRef(ref);
    return this.firestore.fromMemory(ref);
  }

  protected clearCache(refs: CollectionReference<E> | DocumentReference<E> | Query<E> | DocumentReference<E>[]) {
    if (Array.isArray(refs)) return this.firestore.clearCache(refs.map(ref => ref.path));
    if (isQuery(refs)) return this.firestore.clearCache(refs);
    return this.firestore.clearCache(refs?.path);
  }

  /** Function triggered when adding/updating data to firestore */
  protected toFirestore(entity: FireEntity<E>, actionType: 'add' | 'update'): any | Promise<any> {
    if (actionType === 'add') {
      const _meta: MetaDocument = { createdAt: new Date(), modifiedAt: new Date() };
      return { _meta, ...entity };
    } else {
      return { ...entity, '_meta.modifiedAt': new Date() };
    }
  }

  /** Function triggered when getting data from firestore */
  protected fromFirestore(snapshot: DocumentSnapshot<E> | QueryDocumentSnapshot<E>): E | undefined {
    if (snapshot.exists()) {
      return { ...toDate(snapshot.data()), [this.idKey]: snapshot.id };
    } else {
      return undefined;
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

  /** Get the content of the snapshot */
  protected snapToData(snap: DocumentSnapshot<E>): E;
  protected snapToData(snap: DocumentSnapshot<E>[]): E[];
  protected snapToData(snap: QuerySnapshot<E>): E[];
  protected snapToData(snap: QuerySnapshot<E> | DocumentSnapshot<E> | DocumentSnapshot<E>[]): E | E[];
  protected snapToData(snap: QuerySnapshot<E> | DocumentSnapshot<E> | DocumentSnapshot<E>[]): E | E[] {
    if (snap instanceof DocumentSnapshot) return this.fromFirestore(snap) as E;
    const snaps = Array.isArray(snap) ? snap : snap.docs;
    return snaps.map(s => this.snapToData(s)).filter(isNotUndefined);
  }

  /** Get the content of reference(s) */
  protected async getFromRef(ref: DocumentReference<E>): Promise<E | undefined>;
  protected async getFromRef(ref: DocumentReference<E>[]): Promise<E[]>;
  protected async getFromRef(ref: CollectionReference<E> | Query<E>): Promise<E[]>;
  protected async getFromRef(
    ref: DocumentReference<E> | DocumentReference<E>[] | CollectionReference<E> | Query<E>
  ): Promise<undefined | E | E[]>;
  protected async getFromRef(
    ref: DocumentReference<E> | DocumentReference<E>[] | CollectionReference<E> | Query<E>
  ): Promise<undefined | E | E[]> {
    if (Array.isArray(ref)) return Promise.all(ref.map(getDoc)).then(snaps => this.snapToData(snaps));
    if (ref.type === 'document') return getDoc(ref).then(snap => this.snapToData(snap));
    return getDocs(ref).then(snap => this.snapToData(snap));
  }

  /** Observable the content of reference(s)  */
  protected fromRef(ref: DocumentReference<E>): Observable<E | undefined>;
  protected fromRef(ref: DocumentReference<E>[]): Observable<E[]>;
  protected fromRef(ref: CollectionReference<E> | Query<E>): Observable<E[]>;
  protected fromRef(
    ref: DocumentReference<E> | DocumentReference<E>[] | CollectionReference<E> | Query<E>
  ): Observable<undefined | E | E[]>;
  protected fromRef(
    ref: DocumentReference<E> | DocumentReference<E>[] | CollectionReference<E> | Query<E>
  ): Observable<undefined | E | E[]> {
    if (isPlatformServer(this.platformId)) {
      return this.zone.runOutsideAngular(() => from(this.getFromRef(ref as any))).pipe(
        keepUnstableUntilFirst(this.zone),
      );
    }
    if (Array.isArray(ref)) {
      if (!ref.length) return of([]);
      const queries = ref.map(r => this.useCache(r));
      return combineLatest(queries).pipe(map(snaps => this.snapToData(snaps)));
    } else {
      return this.useCache(ref).pipe(map(snaps => this.snapToData(snaps)));
    }
  }

  ///////////////
  // SNAPSHOTS //
  ///////////////

  /** Get the reference of the document, collection or query */
  public getRef(): CollectionReference<E>;
  public getRef(ids: string[], params?: Params): DocumentReference<E>[];
  public getRef(constraints: QueryConstraint[], params: Params): Query<E>;
  public getRef(id: string, params?: Params): DocumentReference<E>;
  public getRef(path: string, params?: Params): DocumentReference<E> | CollectionReference<E>;
  public getRef(params: Params): CollectionReference<E>;
  public getRef(
    ids?: string | string[] | Params | QueryConstraint[],
    params?: Params
  ): undefined | Query<E> | CollectionReference<E> | DocumentReference<E> | DocumentReference<E>[]
  public getRef(
    ids?: string | string[] | Params | QueryConstraint[],
    params?: Params
  ): undefined | Query<E> | CollectionReference<E> | DocumentReference<E> | DocumentReference<E>[] {
    // Collection
    if (!arguments.length) return this.firestore.getRef(this.path);
    // Id is undefined or null
    if (!ids) return undefined;
    // List of Ref
    if (Array.isArray(ids) && (ids as any[]).every(isPathRef)) {
      return this.firestore.getRef(ids as string[]); // (ids as string[]).map(id => this.getRef(id));
    }
    // Ref
    if (isPathRef(ids)) return this.firestore.getRef(ids);

    // Merge params & path
    params = (!Array.isArray(ids) && typeof ids === 'object') ? ids : params;
    const path = pathWithParams(this.path, params);

    // Id
    if (typeof ids === 'string') return this.firestore.getRef(getDocPath(path, ids));

    if (Array.isArray(ids)) {
      // List of ids
      if (isIdList(ids)) return this.firestore.getRef(ids.map((id) => getDocPath(path, id)));
      // List of constraints
      return this.firestore.getRef(path, ids);
    }
    throw new Error('Unexpected params in "getRef".');
  }


  /** Clear cache and get the latest value into the cache */
  public async reload(ids?: string[]): Promise<E[]>;
  public async reload(query?: QueryConstraint[]): Promise<E[]>;
  public async reload(id?: string | null): Promise<E | undefined>;
  public async reload(
    idOrQuery?: string | string[] | QueryConstraint[] | null,
  ): Promise<E | E[] | undefined> {
    if (!this.memorize) return;
    const ref = idOrQuery ? this.getRef(idOrQuery) : this.getRef();
    if (!ref) return;
    this.clearCache(ref);
    return this.load(idOrQuery);
  }

  /** Get the last content from the app (if value has been cached, it won't do a server request) */
  public async load(ids?: string[]): Promise<E[]>;
  public async load(query?: QueryConstraint[]): Promise<E[]>;
  public async load(id?: string | null): Promise<E | undefined>;
  public async load(
    idOrQuery?: string | string[] | QueryConstraint[] | null,
  ): Promise<E | E[] | undefined>
  public async load(
    idOrQuery?: string | string[] | QueryConstraint[] | null,
  ): Promise<E | E[] | undefined> {
    if (idOrQuery === null) return;
    if (arguments.length && typeof idOrQuery === 'undefined') return;
    // Force type to work
    return this.valueChanges(idOrQuery).pipe(take(1)).toPromise();
  }

  /** Return the current value of the path from Firestore */
  public async getValue(ids?: string[]): Promise<E[]>;
  public async getValue(query?: QueryConstraint[]): Promise<E[]>;
  public async getValue(id?: string | null): Promise<E | undefined>;
  public async getValue(idOrQuery?: null | string | string[] | QueryConstraint[]): Promise<E | E[] | undefined> {
    if (idOrQuery === null) return;
    if (arguments.length && typeof idOrQuery === 'undefined') return;
    const ref = this.getRef(idOrQuery);
    if (!ref) return;
    return this.getFromRef(ref);
  }

  /** Listen to the changes of values of the path from Firestore */
  public valueChanges(ids?: string[]): Observable<E[]>;
  public valueChanges(query?: QueryConstraint[]): Observable<E[]>;
  public valueChanges(id?: string | null): Observable<E | undefined>;
  public valueChanges(
    idOrQuery?: string | string[] | QueryConstraint[] | null,
  ): Observable<E | E[] | undefined>;
  public valueChanges(
    idOrQuery?: string | string[] | QueryConstraint[] | null,
  ): Observable<E | E[] | undefined> {
    // If there is an argument, and it's undefined, we don't query anything
    if (idOrQuery === null) return of(undefined);
    if (arguments.length && typeof idOrQuery === 'undefined') return of(undefined);

    if (Array.isArray(idOrQuery) && !idOrQuery.length) return of([]);

    const ref = this.getRef(idOrQuery);
    if (!ref) return of(undefined);
    return this.fromRef(ref);
  }


  ///////////
  // WRITE //
  ///////////
  /**
   * Create or update documents
   * @param documents One or many documents
   * @param options options to write the document on firestore
   */
  upsert(documents: FireEntity<E>, options?: WriteOptions): Promise<string>;
  upsert(documents: FireEntity<E>[], options?: WriteOptions): Promise<string[]>;
  async upsert(
    documents: FireEntity<E> | FireEntity<E>[],
    options: WriteOptions = {}
  ): Promise<string | string[]> {
    const doesExist = async (doc: FireEntity<E>) => {
      const id: string | FieldValue | undefined = doc[this.idKey];
      if (typeof id !== 'string') return false;
      const ref = this.getRef(id, options.params);
      const snap = (options.write instanceof Transaction)
        ? await options.write?.get(ref)
        : await getDoc(ref);
      return snap.exists();
    };
    const upsert = async (doc: FireEntity<E>) => {
      const exists = await doesExist(doc);
      if (!exists) return this.add(doc, options);
      await this.update(doc, options);
      return doc[this.idKey] as string;
    }
    return Array.isArray(documents)
      ? Promise.all(documents.map(upsert))
      : upsert(documents);
  }

  /**
   * Add a document or a list of document to Firestore
   * @param docs A document or a list of document
   * @param options options to write the document on firestore
   */
  add(documents: FireEntity<E>, options?: WriteOptions): Promise<string>;
  add(documents: FireEntity<E>[], options?: WriteOptions): Promise<string[]>;
  async add(
    documents: FireEntity<E> | FireEntity<E>[],
    options: WriteOptions = {}
  ): Promise<string | string[]> {
    const docs = Array.isArray(documents) ? documents : [documents];
    const { write = this.batch(), ctx } = options;
    const operations = docs.map(async (value) => {
      const id = (value[this.idKey] as string | undefined) || this.createId();
      const data = await this.toFirestore(value, 'add');
      if (this.storeId) data[this.idKey] = id;
      const ref = this.getRef(id, options.params);
      (write as WriteBatch).set(ref, data);
      if (this.onCreate) {
        await this.onCreate(data, { write, ctx });
      }
      return id;
    });
    const ids: string[] = await Promise.all(operations);
    // If there is no atomic write provided
    if (!options.write) {
      await (write as WriteBatch).commit();
    }
    return Array.isArray(documents) ? ids : ids[0];
  }

  /**
   * Remove one or several document from Firestore
   * @param id A unique or list of id representing the document
   * @param options options to write the document on firestore
   */
  async remove(id: string | string[], options: WriteOptions = {}) {
    const { write = this.batch(), ctx } = options;
    const ids: string[] = Array.isArray(id) ? id : [id];
    const refs: DocumentReference<E>[] = [];
    const operations = ids.map(async (docId) => {
      const ref = this.getRef(docId, options.params);
      write.delete(ref);
      if (this.onDelete) {
        await this.onDelete(docId, { write, ctx });
      }
      refs.push(ref);
    });
    await Promise.all(operations);
    // If there is no atomic write provided
    if (!options.write) {
      await (write as WriteBatch).commit();
      if (this.memorize) this.clearCache(refs);
    }
  }

  /** Remove all document of the collection */
  async removeAll(options: WriteOptions = {}) {
    const ref = options.params ? this.getRef(options.params) : this.getRef();
    const snapshot = await getDocs(ref);
    const ids = snapshot.docs.map((doc) => doc.id);
    await this.remove(ids, options);
    if (this.memorize) this.clearCache(ref);
  }

  /**
   * Update one or several document in Firestore
   */
  update(entity: FireEntity<E> | FireEntity<E>[], options?: WriteOptions): Promise<void>;
  update(id: string | string[], entityChanges: FireEntity<E>, options?: WriteOptions): Promise<void>;
  update(
    ids: string | string[],
    stateFunction: UpdateCallback<E>,
    options?: WriteOptions
  ): Promise<Transaction[]>;
  async update(
    idsOrEntity: FireEntity<E> | FireEntity<E>[] | string | string[],
    stateFnOrWrite?: UpdateCallback<E> | FireEntity<E> | WriteOptions,
    options: WriteOptions = {}
  ): Promise<void | Transaction[]> {
    let ids: string[] = [];
    let stateFunction: UpdateCallback<E> | undefined;
    let getData: (docId: string) => FireEntity<E>;

    const isEntity = (value: DocumentData | string): value is FireEntity<E> => {
      return typeof value === 'object' && value[this.idKey];
    };
    const isEntityArray = (values: DocumentData | string[] | string): values is FireEntity<E>[] => {
      return Array.isArray(values) && values.every((value) => isEntity(value));
    };

    if (isEntity(idsOrEntity)) {
      ids = [idsOrEntity[this.idKey] as string];
      getData = () => idsOrEntity;
      options = (stateFnOrWrite as WriteOptions) || {};
    } else if (isEntityArray(idsOrEntity)) {
      const entityMap = new Map(
        idsOrEntity.map((entity) => [entity[this.idKey] as string, entity])
      );
      ids = Array.from(entityMap.keys());
      getData = (docId) => entityMap.get(docId)!;
      options = (stateFnOrWrite as WriteOptions) || {};
    } else if (typeof stateFnOrWrite === 'function') {
      ids = Array.isArray(idsOrEntity) ? idsOrEntity : [idsOrEntity];
      stateFunction = stateFnOrWrite as UpdateCallback<E>;
    } else if (typeof stateFnOrWrite === 'object') {
      ids = Array.isArray(idsOrEntity) ? idsOrEntity : [idsOrEntity];
      getData = () => stateFnOrWrite as FireEntity<E>;
    } else {
      throw new Error('Passed parameters match none of the function signatures.');
    }

    const { ctx } = options;
    if (!Array.isArray(ids) || !ids.length) {
      return;
    }

    // If update depends on the entity, use transaction
    if (stateFunction) {
      let refs: DocumentReference<E>[] = [];
      await runTransaction(this.db, async (tx) => {
        refs = [];
        const operations = ids.map(async (id) => {
          const ref = this.getRef(id, options.params);
          refs.push(ref);
          const snapshot = await tx.get(ref);
          const doc = this.fromFirestore(snapshot);
          if (doc && stateFunction) {
            const data = await stateFunction(Object.freeze(doc), tx);
            const result = await this.toFirestore(data, 'update');
            tx.update(ref, result);
            if (this.onUpdate) {
              await this.onUpdate(data, { write: tx, ctx });
            }
          }
          return tx;
        });
        return Promise.all(operations);
      });
      if (this.memorize) this.clearCache(refs);
    } else {
      const { write = this.batch() } = options;
      const refs: DocumentReference<E>[] = [];
      const operations = ids.map(async (docId) => {
        const doc = Object.freeze(getData(docId));
        if (!docId) {
          throw new Error(`Document should have an unique id to be updated, but none was found in ${doc}`);
        }
        const ref = this.getRef(docId, options.params);
        refs.push(ref);
        const data = await this.toFirestore(doc, 'update');
        (write as WriteBatch).update(ref, data);
        if (this.onUpdate) {
          await this.onUpdate(doc, { write, ctx });
        }
      });
      await Promise.all(operations);
      // If there is no atomic write provided
      if (!options.write) {
        await (write as WriteBatch).commit();
        if (this.memorize) this.clearCache(refs)
      }
    }
  }
}
