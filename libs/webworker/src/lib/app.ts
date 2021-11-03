import type { FirebaseApp, FirebaseOptions } from "firebase/app";
import type { FirestoreApi } from "./firestore";
import type { AuthApi } from "./auth";
import { initializeApp } from "firebase/app";
import * as comlink from "comlink";

let app: FirebaseApp;
let config: FirebaseOptions;


async function _getApp() {
  if (!app) {
    const options = config || {};
    app = initializeApp(options);
  }
  return app;
}


export async function startApp(api: FireApi, options: FirebaseOptions) {
  config = options;
  const exposedApi: any = {};
  Object.entries(api).forEach(([key, value]) => exposedApi[key] = comlink.proxy(value));
  comlink.expose(exposedApi);
}


export interface FireApi {
  firestore?: FirestoreApi;
  auth?: AuthApi
}

export {
  _getApp as getApp,
};
