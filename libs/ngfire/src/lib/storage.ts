import { inject, Injectable, InjectionToken } from "@angular/core";
import { getConfig } from "./config";
import { FirebaseStorage, getStorage, ref, uploadBytesResumable, UploadMetadata } from "firebase/storage";
import { initializeApp } from "firebase/app";

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

@Injectable({ providedIn: 'root' })
export class FireStorage {
  private getStorage = inject(FIRE_STORAGE);
  protected bucket?: string;

  protected get storage() {
    return this.getStorage(this.bucket);
  }

  ref(url: string) {
    return ref(this.storage, url);
  }

  upload(url: string, bytes: Blob | Uint8Array | ArrayBuffer, metadata?: UploadMetadata) {
    const ref = this.ref(url);
    return uploadBytesResumable(ref, bytes, metadata);
  }
}