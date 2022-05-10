import { inject, InjectionToken } from "@angular/core";
import { FirebaseStorage, getStorage } from "firebase/storage";
import { FIREBASE_APP } from "../app";
import { getConfig } from "../config";

export const GET_FIRE_STORAGE = new InjectionToken<(bucket?: string) => FirebaseStorage>('Firebase Storage', {
  providedIn: 'root',
  factory: () => {
    const storages: Record<string, FirebaseStorage> = {};
    const config = getConfig();
    const app = inject(FIREBASE_APP);
    return (bucket?: string) => {
      const name = bucket ?? 'default';
      if (!storages[name]) {
        storages[name] = getStorage(app, bucket);
        if (config.storage) config.storage(storages[name]);
      }
      return storages[name];
    }
  },
});
