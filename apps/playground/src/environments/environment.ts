// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import { Firestore, connectFirestoreEmulator } from "firebase/firestore";
import { Auth, connectAuthEmulator } from "firebase/auth";
import { FirebaseStorage, connectStorageEmulator } from "firebase/storage";
import { Functions, connectFunctionsEmulator } from "firebase/functions";

export const environment = {
  production: false,
  firebase: {
    options: {
      projectId: 'demo-firebase',
      apiKey: 'abcd',
      authDomain: 'demo-firebase.firebaseapp.com',
      storageBucket: 'default-bucket',
    },
    firestore: (firestore: Firestore) => {
      connectFirestoreEmulator(firestore, 'localhost', 8000);
    },
    auth: (auth: Auth) => {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    },
    storage: (storage: FirebaseStorage) => {
      connectStorageEmulator(storage, "localhost", 9199);
    },
    functions: (functions: Functions) => {
      connectFunctionsEmulator(functions, "localhost", 5001);
    }
  },
  useEmulators: true
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
