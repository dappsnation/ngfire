// WIP

// import { inject, Injectable } from "@angular/core";
// import { collection, doc, query, runTransaction, writeBatch } from 'firebase/firestore';
// import type { Transaction, CollectionReference, DocumentReference, Query, QueryConstraint } from 'firebase/firestore';
// import { FIRESTORE } from "../firestore";
// import { Params } from "../types";
// import { assertPath, pathWithParams } from "../utils";

// type Reference<E> = CollectionReference<E> | DocumentReference<E>;

// @Injectable({ providedIn: 'root' })
// export class Firestore {
//   private getFirestore = inject(FIRESTORE);

//   protected get db() {
//     return this.getFirestore();
//   }

//   /** Get the reference of the document, collection or query */
//   public getRef<E>(path: string, params?: Params): Reference<E>;
//   public getRef<E>(paths: string[], params?: Params): DocumentReference<E>[];
//   public getRef<E>(path: string, constraints: QueryConstraint[], params?: Params): Query;
//   public getRef<E>(paths: string[], constraints: QueryConstraint[], params?: Params): Query;
//   // overload used internally when looping over paths array
//   public getRef<E>(paths: string, constraints?: Params | QueryConstraint[], params?: Params): Query | Reference<E>;
//   public getRef<E>(
//     paths: string | string[],
//     paramsOrConstraints?: Params | QueryConstraint[],
//     params?: Params
//   ): undefined | Query | Query[] | Reference<E> | DocumentReference<E>[] {
//     if (!arguments.length || !paths) return undefined;
//     const hasContraints = Array.isArray(paramsOrConstraints);

//     // TODO: seperate collection & doc
    
//     if (Array.isArray(paths)) {
//       return paths.map((path) => this.getRef<E>(path, paramsOrConstraints, params));
//     }

//     if (hasContraints) {
//       const path = pathWithParams(paths, params);
//       assertPath(path);
//       const ref = collection(this.db, path);
//       return query(ref, ...paramsOrConstraints);
//     } else {
//       const path = pathWithParams(paths, paramsOrConstraints);
//       assertPath(path);
//       return doc(this.db, path);
//     }
//   }

//   batch() {
//     return writeBatch(this.db);
//   }

//   runTransaction<T>(cb: (transaction: Transaction) => Promise<T>) {
//     return runTransaction<T>(this.db, (tx) => cb(tx));
//   }

//   createId() {
//     return doc(collection(this.db, '__')).id;
//   }

// }