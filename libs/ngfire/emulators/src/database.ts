import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import { FirebaseParams } from "./types";

export const databaseEmulator = (...emulatorParams: FirebaseParams<typeof connectDatabaseEmulator>) => {
  return (...params: Parameters<typeof getDatabase>) => {
    const database = getDatabase(...params);
    connectDatabaseEmulator(database, ...emulatorParams);
    return database;
  }
}