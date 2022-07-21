import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { FirebaseParams } from "./types";

export const functionsEmulator = (...emulatorParams: FirebaseParams<typeof connectFunctionsEmulator>) => {
  return (...params: Parameters<typeof getFunctions>) => {
    const functions = getFunctions(...params);
    connectFunctionsEmulator(functions, ...emulatorParams);
    return functions;
  }
}