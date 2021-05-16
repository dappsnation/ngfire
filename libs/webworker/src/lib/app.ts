import type { FirebaseApp, FirebaseOptions } from "firebase/app";
import { collection, Unsubscribe } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import * as comlink from "comlink";
import { query, where, limit, doc, enableIndexedDbPersistence, FirebaseFirestore, getDoc, getFirestore, onSnapshot, setDoc, useFirestoreEmulator } from "firebase/firestore";

interface FirebaseConfig {
  firebase: FirebaseOptions;
  firestore: {
    useEmulator?: string;
    enablePersistence?: boolean;
  }
}

const firebase: Partial<{
  config: FirebaseConfig,
  app: FirebaseApp,
  firestore: FirebaseFirestore
}> = {};

async function _getApp() {
  if (!firebase.app) {
    const options = firebase.config?.firebase || {};
    firebase.app = initializeApp(options);
  }
  return firebase.app;
}

async function _getFirestore() {
  if (!firebase.firestore) {
    const options = firebase.config?.firestore || {};
    const app = await _getApp();
    const db = getFirestore(app);
    // Should be just after getFirestore
    if (options.useEmulator) {
      const [host, port] = options.useEmulator.split(':');
      useFirestoreEmulator(db, host, parseInt(port));
    }
    if (options.enablePersistence) {
      await enableIndexedDbPersistence(db, { forceOwnership: true });
    }
    firebase.firestore = db;
  }
  return firebase.firestore!;
}

const unsubscribes: Record<string, Unsubscribe> = {};

function generateUUID() {
  return new Array(4)
    .fill(0)
    .map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16))
    .join("-");
}


const factory = { where, limit };
type Constraint = typeof factory;
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
    if (isConstraint(param, 'where')) return factory.where(...param.payload);
    if (isConstraint(param, 'limit')) return factory.limit(...param.payload);
    return;
  }).filter(exist);
}

export const api = {
  firestore: comlink.proxy({
    async getDoc(path: string) {
      const db = await _getFirestore();
      const ref = doc(db, path);
      const snap = await getDoc(ref);
      return snap.data();
    },
    async setDoc<T>(path: string, data: Partial<T>) {
      const db = await _getFirestore();
      const ref = doc(db, path);
      return setDoc(ref, data);
    },
    async onSnapshot(path: string, params: ConstraintParams[], cb: (data: any) => void) {
      const id = generateUUID();
      const db = await _getFirestore();
      if (path.split('/').length % 2 === 0) {
        const ref = doc(db, path);
        unsubscribes[id] = onSnapshot(ref, {
          next: snap => cb(snap.data())
        });
        return id;
      } else {
        const ref = collection(db, path);
        const queryCollection = query(ref, ...getQuery(params));
        unsubscribes[id] = onSnapshot(queryCollection, {
          next: snap => cb(snap.docs.map(d => d.data()))
        });
        return id;
      }
    },
    unsubscribe(id: string) {
      unsubscribes[id]();
      delete unsubscribes[id];
    }
  }),
}


export async function startApp(config: FirebaseConfig) {
  firebase.config = config;
  comlink.expose(api);
}

export type FireApi = typeof api // ReturnType<typeof getApi>;
