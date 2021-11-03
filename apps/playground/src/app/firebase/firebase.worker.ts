/// <reference lib="webworker" />
import { startApp, useFirestore, useFirestoreEmulator, useAuthEmulator, useAuth } from '@ngfire/webworker';
import { environment } from '../../environments/environment';

startApp({
  firestore: useFirestore({
    useEmulator: useFirestoreEmulator('localhost:8000')
  }),
  // auth: useAuth({
  //   useEmulator: useAuthEmulator('localhost:9099')
  // })
}, environment.firebase);