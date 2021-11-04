import { InjectionToken } from "@angular/core";
import type { Functions } from "firebase/functions";
import type { FirebaseStorage } from "firebase/storage";
import type { FirebaseOptions } from 'firebase/app';
import type { Auth } from "firebase/auth";
import type { Firestore } from 'firebase/firestore';

interface FirebaseConfig {
  options: FirebaseOptions,
  firestore?: (firestore: Firestore) => void,
  auth?: (auth: Auth) => void,
  storage?: (storage: FirebaseStorage) => void,
  functions?: (functions: Functions) => void,
}

export const FIREBASE_CONFIG = new InjectionToken<FirebaseConfig>('Firebase Config');
export const REGION_OR_DOMAIN = new InjectionToken<string>('Firebase cloud functions region or domain');
