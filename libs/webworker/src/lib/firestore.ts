import { Unsubscribe, enableIndexedDbPersistence, Firestore, FirestoreDataConverter, DocumentReference, CollectionReference, QueryDocumentSnapshot, SnapshotOptions } from "firebase/firestore";
import { collection, query, doc, getDoc, getDocs, getFirestore, onSnapshot, setDoc, useFirestoreEmulator } from "firebase/firestore";
// QueryConstraint
import { startAt, startAfter, endAt, where, limit, limitToLast, orderBy } from "firebase/firestore";
import { getApp } from './app';


interface FirestoreConfig {
  idKey: string;
  pathKey?: string;
  useEmulator?: ReturnType<typeof _useFirestoreEmulator>;
  enablePersistence?: typeof enableIndexedDbPersistence;
}

let _firestore: Firestore;
let _config: FirestoreConfig;

async function _getFirestore() {
  if (!_firestore) {
    const options = _config || {};
    const app = await getApp();
    const db = getFirestore(app);
    // Should be just after getFirestore
    if (options.useEmulator) {
      options.useEmulator(db)
    }
    if (options.enablePersistence) {
      await options.enablePersistence(db, { forceOwnership: true });
    }
    _firestore = db;
  }
  return _firestore;
}

const unsubscribes: Record<string, Unsubscribe> = {};

function generateUUID() {
  return new Array(4)
    .fill(0)
    .map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16))
    .join("-");
}

function isDocPath(path: string) {
  return path.split('/').length % 2 === 0;
}


////////////
// CONFIG //
////////////
export function _useFirestoreEmulator(url: string) {
  const [host, port] = url.split(':');
  return (db: FirebaseFirestore) => useFirestoreEmulator(db, host, parseInt(port));
}

///////////
// QUERY //
///////////
interface Constraint {
  where: typeof where;
  limit: typeof limit;
  startAt: typeof startAt;
  startAfter: typeof startAfter;
  endAt: typeof endAt;
  limitToLast: typeof limitToLast;
  orderBy: typeof orderBy;
};
type ConstraintKeys = keyof Constraint;
export type ConstraintParams<K extends ConstraintKeys = ConstraintKeys> = {
  type: K,
  payload: Parameters<Constraint[K]>
}
function isConstraint<key extends ConstraintKeys>(param: ConstraintParams, key: key): param is ConstraintParams<key> {
  return param.type === key;
}
function exist<T>(v: T | undefined | null): v is T {
  return !!v;
}
function getQuery(params: ConstraintParams[]) {
  return params.map(param => {
    if (isConstraint(param, 'where')) return where(...param.payload);
    if (isConstraint(param, 'limit')) return limit(...param.payload);
    if (isConstraint(param, 'startAt')) return startAt(...param.payload);
    if (isConstraint(param, 'startAfter')) return startAfter(...param.payload);
    if (isConstraint(param, 'endAt')) return endAt(...param.payload);
    if (isConstraint(param, 'limitToLast')) return limitToLast(...param.payload);
    if (isConstraint(param, 'orderBy')) return orderBy(...param.payload);
    return;
  }).filter(exist);
}

///////////////
// CONVERTER //
///////////////
export interface QueryOptions {
  expands?: string[];
}

async function expand<T>(data: T, expand: string[] = []) {
  if (!expand.length) return data;
  const promises = expand.map(async segments => {
    let parent = data as any;
    for (const segment of segments.split('.')) {
      const child = parent[segment];
      if (child instanceof DocumentReference) {
        parent[segment] = await _getDoc(child.path);
        break;
      } else if (child instanceof CollectionReference) {
        parent[segment] = await _getDocs(child.path);
        break;
      } else if (typeof child === 'string') {
        parent[segment] = await _getDoc(child);
        break;
      } else if (Array.isArray(child)) {
        // TODO support more than string value in array
        parent[segment] = await Promise.all(child.map(path => _getDoc(path)));
      } else {
        parent = child;
      }
    }
  });
  await Promise.all(promises);
  return data;
}

function convert(value: any): any {
  if (value instanceof DocumentReference) {
    return value.path;
  }
  if (value instanceof CollectionReference) {
    return value.path;
  }
  if (Array.isArray(value)) {
    return value.map(convert);
  }
  if (typeof value === 'object' && value !== null) {
    const res: Record<string | number, any> = {};
    for (const [key, v] of Object.entries(value)) {
      res[key] = convert(v);
    }
    return res;
  }
  return value;
}

function convertor<T>(): FirestoreDataConverter<T> {
  return {
    toFirestore(data: T) {
      return data;
    },
    fromFirestore(snap: QueryDocumentSnapshot<T>, options: SnapshotOptions): T {
      const data = snap.data(options);
      const { idKey, pathKey } = _config;
      const meta = { [idKey]: snap.id };
      if (pathKey) {
        meta[pathKey] = snap.ref.path;
      }
      return {
        ...meta,
        ...convert(data)
      };
    }
  }
};

/////////
// API //
/////////
function _createId() {
  return generateUUID();
}

/**
 * Add, update or set a document
 * If path is a collection path, it'll check if data has value of `idKey`. If not it'll generate an id
 * @param path path of the collection or document.
 * @param data A map of the fields and values for the document.
 * @returns the full path of the document reference
 */
async function _setDoc<T>(path: string, data: Partial<T> = {}) {
  const db = await _getFirestore();
  let fullPath: string;
  if (isDocPath(path)) {
    fullPath = path;
  } else {
    const id: string = (data as any)[_config.idKey] ?? generateUUID();
    fullPath = `${path}/${id}`;
  }
  const ref = doc(db, fullPath).withConverter(convertor());
  await setDoc(ref, data);
  return ref.path;
}

/**
 * Get a data of document or list of document path
 * @param paths The document or list of documents
 * @returns The data of the document or list of document
 */
async function _getDoc<T>(path: string, options?: QueryOptions): Promise<T | undefined>
async function _getDoc<T>(paths: string[], options?: QueryOptions): Promise<(T | undefined)[]>
async function _getDoc<T>(paths: string | string[], options: QueryOptions = {}): Promise<(T | undefined) | (T | undefined)[]> {
  const db = await _getFirestore();
  const get = async (path: string) => {
    const ref = doc(db, path).withConverter<T>(convertor());
    const snap = await getDoc(ref);
    return expand(snap.data(), options.expands);
  }
  return Array.isArray(paths)
    ? Promise.all(paths.map(get))
    : get(paths);
}

/**
 * Get all docs that matches a query
 * @param path Path of the collection
 * @param params Query params constraints
 * @param options Options to customize the query
 * @returns The data of the documents that match the query
 */
async function _getDocs<T>(path: string, params: ConstraintParams[] = [], options: QueryOptions = {}) {
  const db = await _getFirestore();
  const ref = collection(db, path).withConverter<T>(convertor());
  const queryCollection = query(ref, ...getQuery(params));
  const querySnap = await getDocs(queryCollection);
  return querySnap.docs.map(snap => expand(snap.data(), options.expands));
}


async function _onSnapshot<T>(
  path: string,
  params: ConstraintParams[],
  options: QueryOptions,
  cb: (data: T | undefined | T[]) => void
) {
  const id = generateUUID();
  const db = await _getFirestore();
  if (isDocPath(path)) {
    const ref = doc(db, path).withConverter<T>(convertor());
    unsubscribes[id] = onSnapshot(ref, {
      next: snap => cb(snap.data())
    });
  } else {
    const ref = collection(db, path).withConverter<T>(convertor());
    const queryCollection = query(ref, ...getQuery(params));
    unsubscribes[id] = onSnapshot(queryCollection, {
      next: snap => cb(snap.docs.map(d => d.data()))
    });
  }
  return id;
}

function _unsubscribe(id: string) {
  unsubscribes[id]();
  delete unsubscribes[id];
}


export const useFirestore = (options: Partial<FirestoreConfig>) => {
  _config = { idKey: 'id', ...options };
  return {
    setDoc: _setDoc,
    getDoc: _getDoc,
    getDocs: _getDocs,
    onSnapshot: _onSnapshot,
    unsubscribe: _unsubscribe,
    createId: _createId
  }
};

export type FirestoreApi = ReturnType<typeof useFirestore>;

export {
  _useFirestoreEmulator as useFirestoreEmulator
};
export {
  enableIndexedDbPersistence as enablePersistence,
} from 'firebase/firestore';