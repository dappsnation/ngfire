import { inject, Injectable, Injector } from "@angular/core";
import { ref, uploadBytesResumable, UploadMetadata } from "firebase/storage";
import { FIRE_STORAGE } from "./tokens";

@Injectable({ providedIn: 'root' })
export class FireStorage {
  private injector = inject(Injector);
  protected bucket?: string;

  protected get storage() {
    return this.injector.get(FIRE_STORAGE);
  }

  ref(url: string) {
    return ref(this.storage, url);
  }

  upload(url: string, bytes: Blob | Uint8Array | ArrayBuffer, metadata?: UploadMetadata) {
    const ref = this.ref(url);
    return uploadBytesResumable(ref, bytes, metadata);
  }
}