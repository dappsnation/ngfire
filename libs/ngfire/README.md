# ngfire
Unofficial library for angular & firebase.

## Setup

### _Prerequirement_
Install firebase & firebase-tools: 
```
npm install -D firebase-tools
npm install firebase
```

Initialize your firebase project: 
```
npx firebase init
```

### Setup the lib
Install the lib
```
npm install ngfire
```

Add the firebase config

`environment.ts` (use emulator) : 
```typescript
import { authEmulator, databaseEmulator, firestoreEmulator, functionsEmulator, storageEmulator } from "ngfire";

export const environment = {
  production: false,
  firebase: {
    options: {
      projectId: 'demo-firebase',
      apiKey: 'demo',
      authDomain: 'demo-firebase.firebaseapp.com',
      storageBucket: 'default-bucket',
    },
    firestore: firestoreEmulator('localhost', 8000),
    auth: authEmulator('http://localhost:9099', { disableWarnings: true }),
    storage: storageEmulator("localhost", 9199),
    functions: functionsEmulator("localhost", 5001),
    database: databaseEmulator("localhost", 9000),
  },
}
```

`environment.prod.ts` : 
```typescript
export const environment = {
  production: false,
  firebase: {
    options: {
      apiKey: '******',
      authDomain: '******',
      projectId: '******',
      storageBucket: '******',
      messagingSenderId: '******',
      appId: '******',
      measurementId: '******',
    }
  },
}
```

Connect with angular: 
`app.module.ts`:
```typescript
...
import { FIREBASE_CONFIG } from 'ngfire';
import { environment } from '../environments/environment';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, ReactiveFormsModule],
  providers: [{ provide: FIREBASE_CONFIG, useValue: environment.firebase }],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

## CollectionService
You can create a new service per collection of Firestore:

`flight.service.ts`: 
```typescript
import { Injectable } from '@angular/core';
import { FireCollection } from 'ngfire';

export interface Flight {
  number: string;
  info: string;
}

@Injectable({ providedIn: 'root' })
export class FlightService extends FireCollection<Flight> {
  // Collection path
  readonly path = 'flights';
  // Memorize all requests that has been done
  memorize = true;
}
```

The service exposes an API to do most of common tasks: 
- `valueChanges`: returns an `Observable`
- `load`: returns a `Promise` using the cache if available
- `getValue`: returns a `Promise` without using the cache
- `add`: adds a new documet to the collection
- `update`: update an existing document to the collection
- `upsert`: add or update a document
- `remove`: remove a document from the collection
- `removeAll`: remove all documents from a collection


## TransferState (SSR)
`ngfire` supports state transfer from your server into the browser for Documents and Collections (not queries).

To implement it you need to :
1. Set `memorize: true` on the `FireCollection`
2. Add `BrowserTransferStateModule` into your `app.module.ts`:
```typescript
@NgModule({
  imports: [..., BrowserTransferStateModule]
})
```
3. Add `ServerTransferStateModule` into your `app.server.module.ts`:
```typescript
@NgModule({
  imports: [..., ServerTransferStateModule]
})
```