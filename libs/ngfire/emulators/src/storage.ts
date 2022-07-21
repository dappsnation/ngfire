import { connectStorageEmulator, getStorage } from "firebase/storage";
import { FirebaseParams } from "./types";

export const storageEmulator = (...emulatorParams: FirebaseParams<typeof connectStorageEmulator>) => {
  return (...params: Parameters<typeof getStorage>) => {
    const storage = getStorage(...params);
    connectStorageEmulator(storage, ...emulatorParams);
    return storage;
  }
}