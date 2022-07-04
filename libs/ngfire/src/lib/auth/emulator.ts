import { connectAuthEmulator, initializeAuth } from "firebase/auth";
import { FirebaseParams } from "../types";

export const authEmulator = (...emulatorParams: FirebaseParams<typeof connectAuthEmulator>) => {
  return (...params: Parameters<typeof initializeAuth>) => {
    const auth = initializeAuth(...params);
    connectAuthEmulator(auth, ...emulatorParams);
    return auth;
  }
}