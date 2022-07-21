import { connectFirestoreEmulator, initializeFirestore } from "firebase/firestore";
import { FirebaseParams } from "./types";

export const firestoreEmulator = (...emulatorParams: FirebaseParams<typeof connectFirestoreEmulator>) => {
  return (...params: Parameters<typeof initializeFirestore>) => {
    const firestore = initializeFirestore(...params);
    connectFirestoreEmulator(firestore, ...emulatorParams);
    return firestore;
  }
}