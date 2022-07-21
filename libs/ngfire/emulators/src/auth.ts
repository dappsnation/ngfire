import type { FirebaseApp } from "firebase/app";
import { connectAuthEmulator, Dependencies, getAuth, initializeAuth } from "firebase/auth";
import { FirebaseParams } from "./types";

export const authEmulator = (...emulatorParams: FirebaseParams<typeof connectAuthEmulator>) => {
  return (app: FirebaseApp, deps?: Dependencies) => {
    const auth = deps ? initializeAuth(app, deps) : getAuth(app);
    connectAuthEmulator(auth, ...emulatorParams);
    return auth;
  }
}