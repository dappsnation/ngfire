import { InjectionToken } from "@angular/core";
import { initializeApp } from "firebase/app";
import { FirebaseStorage, getStorage } from "firebase/storage";
import { getConfig } from "../config";

export const FIRE_STORAGE = new InjectionToken<(bucket?: string) => FirebaseStorage>('Firebase Storage', {
  providedIn: 'root',
  factory: () => {
    const storages: Record<string, FirebaseStorage> = {};
    const config = getConfig();
    return (bucket?: string) => {
      const name = bucket ?? 'default';
      if (!storages[name]) {
        const app = initializeApp(config.options, config.options.appId);
        storages[name] = getStorage(app, bucket);
        if (config.storage) config.storage(storages[name]);
      }
      return storages[name];
    }
  },
});
