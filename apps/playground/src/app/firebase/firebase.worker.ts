/// <reference lib="webworker" />
import { startApp } from '@ngfire/webworker';
import { environment } from '../../environments/environment';

startApp({
  firebase: environment.firebase,
  firestore: {
    useEmulator: 'localhost:8000',
    enablePersistence: true
  }
});
