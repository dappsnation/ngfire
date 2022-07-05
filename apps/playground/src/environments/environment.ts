// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import { authEmulator, databaseEmulator, firestoreEmulator, functionsEmulator, storageEmulator } from "ngfire";

export const environment = {
  production: false,
  firebase: {
    options: {
      projectId: 'demo-firebase',
      apiKey: 'abcd',
      authDomain: 'demo-firebase.firebaseapp.com',
      storageBucket: 'default-bucket',
    },
    firestore: firestoreEmulator('localhost', 8000),
    auth: authEmulator('http://localhost:9099', { disableWarnings: true }),
    storage: storageEmulator("localhost", 9199),
    functions: functionsEmulator("localhost", 5001),
    database: databaseEmulator("localhost", 9000),
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
