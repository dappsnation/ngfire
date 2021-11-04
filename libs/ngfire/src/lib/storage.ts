import { inject, Injectable, InjectionToken } from "@angular/core";
import { FIREBASE_CONFIG } from "./config";
import { FirebaseStorage, getStorage, ref, uploadBytesResumable, UploadMetadata } from "firebase/storage";
import { initializeApp } from "firebase/app";

export const FIRE_STORAGE = new InjectionToken<() => FirebaseStorage>('Firebase Storage', {
  providedIn: 'root',
  factory: () => {
    let storage: FirebaseStorage;
    const config = inject(FIREBASE_CONFIG);
    const app = initializeApp(config.options, config.options.appId);
    return () => {
      if (!storage) {
        storage = getStorage(app);
        if (config.storage) config.storage(storage);
      }
      return storage;
    }
  },
});

@Injectable({ providedIn: 'root' })
export class FireStorage {
  private getStorage = inject(FIRE_STORAGE);

  protected get storage() {
    return this.getStorage();
  }

  ref(url: string) {
    return ref(this.storage, url);
  }

  upload(url: string, bytes: Blob | Uint8Array | ArrayBuffer, metadata?: UploadMetadata) {
    const ref = this.ref(url);
    return uploadBytesResumable(ref, bytes, metadata);
  }
}