import { inject, InjectFlags, InjectionToken } from "@angular/core";
import { FirebaseStorage, getStorage } from "firebase/storage";
import { FIREBASE_APP } from "../app";
import { getConfig, STORAGE_BUCKET } from "../config";


export const FIRE_STORAGE = new InjectionToken<FirebaseStorage>('Firebase Storage', {
  providedIn: 'root',
  factory: () => {
    const config = getConfig();
    const app = inject(FIREBASE_APP);
    const bucket = inject(STORAGE_BUCKET, InjectFlags.Optional);
    if (config.storage) {
      return config.storage(app, bucket ?? undefined);
    } else {
      return getStorage(app, bucket ?? undefined);
    }
  },
});
