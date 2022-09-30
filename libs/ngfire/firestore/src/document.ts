/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { inject, NgZone, PLATFORM_ID } from '@angular/core';
import { writeBatch, runTransaction, getDoc, Transaction, DocumentSnapshot, FieldValue, setDoc, updateDoc } from 'firebase/firestore';
import type { DocumentData, DocumentReference, QueryDocumentSnapshot, WriteBatch } from 'firebase/firestore';
import { fromRef } from './operators';
import type { WriteOptions, UpdateCallback, MetaDocument, Params, FireEntity, DeepKeys } from 'ngfire/core';
import { keepUnstableUntilFirst, pathWithParams } from 'ngfire/core';
import { Observable, from, firstValueFrom } from 'rxjs';
import { tap, startWith, switchMap } from 'rxjs/operators';

import { isPlatformServer } from '@angular/common';
import { FirestoreService } from './firestore';
import { toDate } from './utils';

/////////////
// SERVICE //
/////////////

export abstract class FireDocument<E extends DocumentData> {
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
  protected onDelete?(path: string, options: WriteOptions): unknown;


  protected get db() {
    return this.firestore.db;
  }

  protected useCache<T extends E>(ref: DocumentReference<T>): Observable<T | undefined> {   
    if (isPlatformServer(this.platformId)) {
      return this.zone.runOutsideAngular(() => fromRef(ref)).pipe(
        switchMap(async snap => this.snapToData(snap)),
        tap(value => this.firestore.setTransfer(ref, value)),
        keepUnstableUntilFirst(this.zone),
      );
    }
    if (!this.memorize) {
      return this.zone.runOutsideAngular(() => fromRef(ref)).pipe(
        switchMap(async snap => this.snapToData(snap)),
        keepUnstableUntilFirst(this.zone)
      );
    }
    const transfer = this.firestore.getTransfer(ref);
    const initial = this.firestore.getState(ref);
    const snap$ = this.zone.runOutsideAngular(() => this.firestore.fromMemory<T>(ref, this.delayToUnsubscribe)).pipe(
      tap(snap => this.firestore.setState(ref, snap)),
      keepUnstableUntilFirst(this.zone)
    );
    if (transfer) return snap$.pipe(switchMap(async snap => this.snapToData(snap)), startWith(transfer));
    if (initial) return snap$.pipe(startWith(initial), switchMap(async snap => this.snapToData(snap)));
    return snap$.pipe(switchMap(async snap => this.snapToData(snap)));
  }

  protected clearCache<T extends E>(ref: DocumentReference<T>) {
    return this.firestore.clearCache(ref.path);
  }

  /** Function triggered when adding/updating data to firestore */
  protected toFirestore<T extends E = E>(entity: FireEntity<T>, actionType: 'create' | 'update'): any | Promise<any> {
    if (actionType === 'create') {
      const _meta: MetaDocument = { createdAt: new Date(), modifiedAt: new Date() };
      return { _meta, ...entity };
    } else {
      return { ...entity, '_meta.modifiedAt': new Date() };
    }
  }

  /** Function triggered when getting data from firestore */
  protected fromFirestore<T extends E = E>(snapshot: DocumentSnapshot<T> | QueryDocumentSnapshot<T>): Promise<T> | T | undefined {
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

  createId(params?: Params) {
    return this.getRef(params)?.id;
  }


  /** Get the content of the snapshot */
  protected snapToData<T extends E = E>(snap: DocumentSnapshot<T>) {
    return this.fromFirestore<T>(snap);
  }

  /** Get the content of reference(s) */
  protected async getFromRef<T extends E = E>(ref: DocumentReference<T>): Promise<T | undefined> {
    const snap = await getDoc(ref);
    return this.snapToData(snap);
  }

  /** Observable the content of reference(s)  */
  protected fromRef<T extends E = E>(ref: DocumentReference<T>): Observable<T | undefined> {
    return this.useCache(ref);
  }

  ///////////////
  // SNAPSHOTS //
  ///////////////

  /** Get the reference of the document, collection or query */
  public getRef<T extends E>(parameters?: Params): DocumentReference<T> {
    const path = parameters ? pathWithParams(this.path, parameters) : this.path;
    const ref = this.firestore.getRef<T>(path) as DocumentReference<T>;
    if (!ref) throw new Error(`Could not create a reference out of path "${path}"`);
    return ref;
  }

  /** Clear cache and get the latest value into the cache */
  public async reload<T extends E = E>(parameters?: Params): Promise<T | undefined> {
    if (!this.memorize) return;
    const ref = this.getRef(parameters);
    this.clearCache(ref);
    return this.load(parameters);
  }

  /** Get the last content from the app (if value has been cached, it won't do a server request) */
  public async load<T extends E>(parameters?: Params): Promise<T | undefined> {
    return firstValueFrom(this.valueChanges(parameters));
  }

  /** Return the current value of the document from Firestore */
  public async getValue<T extends E = E>(parameters?: Params): Promise<T | undefined> {
    const ref = this.getRef<T>(parameters);
    return this.getFromRef<T>(ref);
  }

  /** Listen to the changes of values of the document from Firestore */
  public valueChanges<T extends E = E>(parameters?: Params): Observable<T | undefined> {
    const ref = this.getRef<T>(parameters);
    return this.fromRef<T>(ref);
  }


  ///////////
  // WRITE //
  ///////////
  /**
   * Create or update the document
   * @param document The document to upsert
   * @param options options to write the document on firestore
   */
  async upsert<T extends E>(document: FireEntity<T>, options: WriteOptions = {}): Promise<string> {
    const id: string | FieldValue | undefined = document[this.idKey];
    if (typeof id !== 'string') return this.create(document, options);
    const ref = this.getRef(options.params);
    const snap = (options?.write instanceof Transaction)
      ? await options.write?.get(ref)
      : await getDoc(ref);
    if (snap.exists()) return this.create(document, options);
    await this.update(document, options);
    return id;
  }

  /**
   * Create the document at the specified path
   * @param document The document to create
   * @param options options to write the document on firestore
   */
  async create<T extends E>(document: FireEntity<T>, options: WriteOptions = {}): Promise<string> {
    const baseId: string | FieldValue | undefined = document[this.idKey];
    const id = typeof baseId === 'string' ? baseId : this.createId();
    const data = await this.toFirestore(document, 'create');
    if (this.storeId) data[this.idKey] = id;
    const ref = this.getRef(options.params);
    if (options.write) {
      (options.write as WriteBatch).set(ref, data);
    } else {
      await setDoc(ref, data);
    }
    if (this.onCreate) {
      await this.onCreate(data, { write: options.write, ctx: options.ctx });
    }
    return id;
  }

  /**
   * Delete the document from firestore
   * @param options options to write the document on firestore
   */
  async delete<T extends E>(options: WriteOptions = {}) {
    const { write = this.batch(), ctx, params } = options;
    const ref = this.getRef<T>(params);
    write.delete(ref);
    if (this.onDelete) {
      await this.onDelete(ref.path, { write, ctx });
    }
    // If there is no atomic write provided
    if (!options.write) {
      await (write as WriteBatch).commit();
      if (this.memorize) this.clearCache(ref);
    }
  }

  /** Update document in Firestore */
  update<T extends E>(document: FireEntity<T>, options?: WriteOptions): Promise<void>;
  update<T extends E>(documentChanges: UpdateCallback<T>, options?: WriteOptions): Promise<void>;
  async update<T extends E>(
    changes: UpdateCallback<T> | FireEntity<T>,
    options: WriteOptions = {}
  ): Promise<void> {
    const ref = this.getRef<T>(options.params);
    if (typeof changes === 'function') {
      await runTransaction(this.db, async (tx) => {
        const snapshot = await tx.get(ref);
        const doc = await this.fromFirestore<T>(snapshot);
        if (doc && changes) {
          const data = await changes(doc, tx);
          const result = await this.toFirestore(data, 'update');
          tx.update(ref, result);
          if (this.onUpdate) {
            await this.onUpdate(data, { write: tx, ctx: options.ctx });
          }
        }
      });
    } else {
      const doc = await this.toFirestore<T>(changes, 'update');
      if (options.write) {
        (options.write as WriteBatch).update(ref, doc);
      } else {
        await updateDoc(ref, doc);
      }
      if (this.onUpdate) {
        await this.onUpdate(doc, { write: options.write, ctx: options.ctx });
      }
    }
    if (this.memorize) this.clearCache(ref);

  }
}
