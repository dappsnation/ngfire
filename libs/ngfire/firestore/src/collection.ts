/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { inject, NgZone, PLATFORM_ID } from '@angular/core';
import { writeBatch, runTransaction, doc, collection, Query, getDocs, getDoc, Transaction, DocumentSnapshot, FieldValue } from 'firebase/firestore';
import type { DocumentData, CollectionReference, DocumentReference, QueryConstraint, QueryDocumentSnapshot, QuerySnapshot, WriteBatch } from 'firebase/firestore';
import { fromRef } from './operators';
import type { WriteOptions, UpdateCallback, MetaDocument, Params, FireEntity, DeepKeys } from 'ngfire/core';
import { keepUnstableUntilFirst, isIdList, isNotUndefined, isPathRef, isQuery, pathWithParams } from 'ngfire/core';
import { Observable, of, combineLatest, from, firstValueFrom } from 'rxjs';
import { map, tap, startWith } from 'rxjs/operators';

import { isPlatformServer } from '@angular/common';
import { FirestoreService } from './firestore';
import { toDate, getDocPath } from './utils';

/////////////
// SERVICE //
/////////////

export abstract class FireCollection<E extends DocumentData> {
  protected platformId = inject(PLATFORM_ID);
  protected zone = inject(NgZone);
  protected firestore = inject(FirestoreService);
  protected abstract readonly path: string;
  protected idKey: DeepKeys<E> = 'id' as any;
  /** If true, will store the document id (IdKey) onto the document */
  protected storeId = false;
  /**
   * Cache the snapshot into a global store
   */
  protected memorize = false;
  /**
   * Delay before unsubscribing to a query (used only with memorized is true)
   * Use Infinty for application long subscription
   */
  protected delayToUnsubscribe = 0;

  protected onCreate?(entity: E, options: WriteOptions): unknown;
  protected onUpdate?(entity: FireEntity<E>, options: WriteOptions): unknown;
  protected onDelete?(id: string, options: WriteOptions): unknown;


  protected get db() {
    return this.firestore.db;
  }

  protected useCache<T extends E>(ref: DocumentReference<T>): Observable<T>
  protected useCache<T extends E>(ref: Query<T>): Observable<T[]>
  protected useCache<T extends E>(ref: DocumentReference<T> | Query<T>): Observable<T | T[]>   
  protected useCache<T extends E>(ref: DocumentReference<T> | Query<T>): Observable<T | T[]> {
    if (isPlatformServer(this.platformId)) {
      return this.zone.runOutsideAngular(() => fromRef(ref as Query<T>)).pipe(
        map(snap => this.snapToData(snap)),
        tap(value => this.firestore.setTransfer(ref, value)),
        keepUnstableUntilFirst(this.zone)
      );
    }
    if (!this.memorize) {
      return this.zone.runOutsideAngular(() => fromRef(ref as Query<T>)).pipe(
        map(snap => this.snapToData(snap)),
        keepUnstableUntilFirst(this.zone)
      );
    }
    const transfer = this.firestore.getTransfer(ref);
    const initial = this.firestore.getState(ref);
    const snap$ = this.zone.runOutsideAngular(() => this.firestore.fromMemory(ref, this.delayToUnsubscribe)).pipe(
      tap(snap => this.firestore.setState(ref, snap)),
      keepUnstableUntilFirst(this.zone)
    );
    if (transfer) return snap$.pipe(map(snap => this.snapToData(snap)), startWith(transfer));
    if (initial) return snap$.pipe(startWith(initial), map(snap => this.snapToData(snap)));
    return snap$.pipe(map(snap => this.snapToData(snap)));
  }

  protected clearCache<T extends E>(refs: CollectionReference<T> | DocumentReference<T> | Query<T> | DocumentReference<T>[]) {
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
  protected snapToData<T extends E = E>(snap: DocumentSnapshot<T>): T;
  protected snapToData<T extends E = E>(snap: DocumentSnapshot<T>[]): T[];
  protected snapToData<T extends E = E>(snap: QuerySnapshot<T>): T[];
  protected snapToData<T extends E = E>(snap: QuerySnapshot<T> | DocumentSnapshot<T> | DocumentSnapshot<T>[]): T | T[];
  protected snapToData<T extends E = E>(snap: QuerySnapshot<T> | DocumentSnapshot<T> | DocumentSnapshot<T>[]): T | T[] {
    if (snap instanceof DocumentSnapshot) return this.fromFirestore(snap) as T;
    const snaps = Array.isArray(snap) ? snap : snap.docs;
    return snaps.map(s => this.snapToData(s)).filter(isNotUndefined);
  }

  /** Get the content of reference(s) */
  protected async getFromRef<T extends E = E>(ref: DocumentReference<T>): Promise<T | undefined>;
  protected async getFromRef<T extends E = E>(ref: DocumentReference<T>[]): Promise<T[]>;
  protected async getFromRef<T extends E = E>(ref: CollectionReference<T> | Query<T>): Promise<T[]>;
  protected async getFromRef<T extends E = E>(
    ref: DocumentReference<T> | DocumentReference<T>[] | CollectionReference<T> | Query<T>
  ): Promise<undefined | T | T[]>;
  protected async getFromRef<T extends E = E>(
    ref: DocumentReference<T> | DocumentReference<T>[] | CollectionReference<T> | Query<T>
  ): Promise<undefined | T | T[]> {
    if (Array.isArray(ref)) return Promise.all(ref.map(getDoc)).then(snaps => this.snapToData(snaps));
    const snap = (ref.type === 'document') ? await getDoc(ref) : await getDocs(ref);
    return this.snapToData(snap);
  }

  /** Observable the content of reference(s)  */
  protected fromRef<T extends E = E>(ref: DocumentReference<T>): Observable<T | undefined>;
  protected fromRef<T extends E = E>(ref: DocumentReference<T>[]): Observable<T[]>;
  protected fromRef<T extends E = E>(ref: CollectionReference<T> | Query<T>): Observable<T[]>;
  protected fromRef<T extends E = E>(
    ref: DocumentReference<T> | DocumentReference<T>[] | CollectionReference<T> | Query<T>
  ): Observable<undefined | T | T[]>;
  protected fromRef<T extends E = E>(
    ref: DocumentReference<T> | DocumentReference<T>[] | CollectionReference<T> | Query<T>
  ): Observable<undefined | T | T[]> {
    if (Array.isArray(ref)) {
      if (!ref.length) return of([]);
      const queries = ref.map(r => this.useCache(r));
      return combineLatest(queries);
    } else {
      return this.useCache(ref);
    }
  }

  ///////////////
  // SNAPSHOTS //
  ///////////////

  /** Get the reference of the document, collection or query */
  public getRef<T extends E = E>(): CollectionReference<T>;
  public getRef<T extends E = E>(ids: string[], params?: Params): DocumentReference<T>[];
  public getRef<T extends E = E>(constraints: QueryConstraint[], params: Params): Query<T>;
  public getRef<T extends E = E>(id: string, params?: Params): DocumentReference<T>;
  public getRef<T extends E = E>(path: string, params?: Params): DocumentReference<T> | CollectionReference<T>;
  public getRef<T extends E = E>(params: Params): CollectionReference<T>;
  public getRef<T extends E = E>(
    ids?: string | string[] | Params | QueryConstraint[],
    params?: Params
  ): undefined | Query<T> | CollectionReference<T> | DocumentReference<T> | DocumentReference<T>[]
  public getRef<T extends E>(
    ids?: string | string[] | Params | QueryConstraint[],
    parameters?: Params
  ): undefined | Query<T> | CollectionReference<T> | DocumentReference<T> | DocumentReference<T>[] {
    // Collection
    if (!arguments.length) return this.firestore.getRef(this.path);
    // Id is undefined or null
    if (!ids) return undefined;
    
    if (Array.isArray(ids)) {
      // List of ref
      if ((ids as any[]).every(isPathRef)) return this.firestore.getRef(ids as string[]);
      
      const path = pathWithParams(this.path, parameters);
      // List of ids
      if (isIdList(ids)) return this.firestore.getRef(ids.map((id) => getDocPath(path, id)));
      // List of constraints
      return this.firestore.getRef(path, ids);
    }

    if (typeof ids === 'string') {
      // Ref
      if (isPathRef(ids)) return this.firestore.getRef(ids);
      // Id
      const path = pathWithParams(this.path, parameters);
      return this.firestore.getRef(getDocPath(path, ids));
    }

    // Subcollection
    return this.firestore.getRef(pathWithParams(this.path, ids));
  }


  /** Clear cache and get the latest value into the cache */
  public async reload<T extends E = E>(ids?: string[]): Promise<T[]>;
  public async reload<T extends E = E>(query?: QueryConstraint[]): Promise<T[]>;
  public async reload<T extends E = E>(id?: string | null): Promise<T | undefined>;
  public async reload<T extends E = E>(
    idOrQuery?: string | string[] | QueryConstraint[] | null,
  ): Promise<T | T[] | undefined>
  public async reload<T extends E = E>(): Promise<T | T[] | undefined> {
    if (!this.memorize) return;
    const ref = this.getRef(...arguments);
    if (!ref) return;
    this.clearCache(ref);
    return this.load(...arguments);
  }

  /** Get the last content from the app (if value has been cached, it won't do a server request) */
  public async load<T extends E = E>(ids?: string[]): Promise<T[]>;
  public async load<T extends E = E>(query?: QueryConstraint[]): Promise<T[]>;
  public async load<T extends E = E>(id?: string | null): Promise<T | undefined>;
  public async load<T extends E = E>(
    idOrQuery?: string | string[] | QueryConstraint[] | null,
  ): Promise<T | T[] | undefined>
  public async load<T extends E>(): Promise<T | T[] | undefined> {
    return firstValueFrom(this.valueChanges(...arguments));
  }

  /** Return the current value of the path from Firestore */
  public async getValue<T extends E = E>(ids?: string[]): Promise<T[]>;
  public async getValue<T extends E = E>(query?: QueryConstraint[]): Promise<T[]>;
  public async getValue<T extends E = E>(id?: string | null): Promise<T | undefined>;
  public async getValue<T extends E = E>(idOrQuery?: null | string | string[] | QueryConstraint[]): Promise<T | T[] | undefined>
  public async getValue<T extends E = E>(): Promise<T | T[] | undefined> {
    const ref = this.getRef<T>(...arguments);
    if (!ref) return;
    return this.getFromRef<T>(ref);
  }

  /** Listen to the changes of values of the path from Firestore */
  public valueChanges<T extends E = E>(ids?: string[]): Observable<T[]>;
  public valueChanges<T extends E = E>(query?: QueryConstraint[]): Observable<T[]>;
  public valueChanges<T extends E = E>(id?: string | null): Observable<T | undefined>;
  public valueChanges<T extends E = E>(
    idOrQuery?: string | string[] | QueryConstraint[] | null,
  ): Observable<T | T[] | undefined>;
  public valueChanges<T extends E = E>(
    idOrQuery?: string | string[] | QueryConstraint[] | null,
  ): Observable<T | T[] | undefined> {
    if (Array.isArray(idOrQuery) && !idOrQuery.length) return of([]);
    const ref = this.getRef<T>(...arguments);
    if (!ref) return of(undefined);
    return this.fromRef<T>(ref);
  }


  ///////////
  // WRITE //
  ///////////
  /**
   * Create or update documents
   * @param documents One or many documents
   * @param options options to write the document on firestore
   */
  upsert<T extends E>(documents: FireEntity<T>, options?: WriteOptions): Promise<string>;
  upsert<T extends E>(documents: FireEntity<T>[], options?: WriteOptions): Promise<string[]>;
  async upsert<T extends E>(
    documents: FireEntity<T> | FireEntity<T>[],
    options: WriteOptions = {}
  ): Promise<string | string[]> {
    const doesExist = async (doc: FireEntity<T>) => {
      const id: string | FieldValue | undefined = doc[this.idKey];
      if (typeof id !== 'string') return false;
      const ref = this.getRef(id, options.params);
      const snap = (options.write instanceof Transaction)
        ? await options.write?.get(ref)
        : await getDoc(ref);
      return snap.exists();
    };
    const upsert = async (doc: FireEntity<T>) => {
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
  add<T extends E>(documents: FireEntity<T>, options?: WriteOptions): Promise<string>;
  add<T extends E>(documents: FireEntity<T>[], options?: WriteOptions): Promise<string[]>;
  async add<T extends E>(
    documents: FireEntity<T> | FireEntity<T>[],
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
  async remove<T extends E>(id: string | string[], options: WriteOptions = {}) {
    const { write = this.batch(), ctx } = options;
    const ids: string[] = Array.isArray(id) ? id : [id];
    const refs: DocumentReference<T>[] = [];
    const operations = ids.map(async (docId) => {
      const ref = this.getRef<T>(docId, options.params);
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
  update<T extends E>(entity: FireEntity<T> | FireEntity<T>[], options?: WriteOptions): Promise<void>;
  update<T extends E>(id: string | string[], entityChanges: FireEntity<T>, options?: WriteOptions): Promise<void>;
  update<T extends E>(
    ids: string | string[],
    stateFunction: UpdateCallback<T>,
    options?: WriteOptions
  ): Promise<Transaction[]>;
  async update<T extends E>(
    idsOrEntity: FireEntity<T> | FireEntity<T>[] | string | string[],
    stateFnOrWrite?: UpdateCallback<T> | FireEntity<T> | WriteOptions,
    options: WriteOptions = {}
  ): Promise<void | Transaction[]> {
    let ids: string[] = [];
    let stateFunction: UpdateCallback<T> | undefined;
    let getData: (docId: string) => FireEntity<T>;

    const isEntity = (value: DocumentData | string): value is FireEntity<T> => {
      return typeof value === 'object' && value[this.idKey];
    };
    const isEntityArray = (values: DocumentData | string[] | string): values is FireEntity<T>[] => {
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
      stateFunction = stateFnOrWrite as UpdateCallback<T>;
    } else if (typeof stateFnOrWrite === 'object') {
      ids = Array.isArray(idsOrEntity) ? idsOrEntity : [idsOrEntity];
      getData = () => stateFnOrWrite as FireEntity<T>;
    } else {
      throw new Error('Passed parameters match none of the function signatures.');
    }

    const { ctx } = options;
    if (!Array.isArray(ids) || !ids.length) {
      return;
    }

    // If update depends on the entity, use transaction
    if (stateFunction) {
      let refs: DocumentReference<T>[] = [];
      await runTransaction(this.db, async (tx) => {
        refs = [];
        const operations = ids.map(async (id) => {
          const ref = this.getRef<T>(id, options.params);
          refs.push(ref);
          const snapshot = await tx.get(ref);
          const doc = this.fromFirestore(snapshot);
          if (doc && stateFunction) {
            const data = await stateFunction(doc as T, tx);
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
      const refs: DocumentReference<T>[] = [];
      const operations = ids.map(async (docId) => {
        const doc = getData(docId);
        if (!docId) {
          throw new Error(`Document should have an unique id to be updated, but none was found in ${doc}`);
        }
        const ref = this.getRef<T>(docId, options.params);
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
