import { inject, Injectable } from "@angular/core";
import { ref, uploadBytesResumable, UploadMetadata } from "firebase/storage";
import { GET_FIRE_STORAGE } from "./tokens";

@Injectable({ providedIn: 'root' })
export class FireStorage {
  private getStorage = inject(GET_FIRE_STORAGE);
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