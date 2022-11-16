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

`environment.prod.ts` (use your project's config here) : 
```typescript
export const environment = {
  production: true,
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

## Collection Service
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

  // Key used to get the id (default: "id")
  readonly idKey = 'id';

  // Memorize all requests that has been done
  memorize = true;
}
```

And use it in the component
`app.component.ts`: 
```typescript
@Component({
  selector: 'ngfire-root',
  template: `
    <ul>
      <li *ngFor="let flight of flight$ | async">
        {{ flight.number }}: {{ flight.info }}
      </li>
    </ul>

    <form [formGroup]="form" (ngSubmit)="add()">
      <input formControlName="number" />
      <textarea formControlName="info"></textarea>
      <button>Submit</button>
    </form>
  `,
})
export class AppComponent {
  form = new FormGroup({
    number: new FormControl(),
    info: new FormControl()
  });
  flight$ = this.service.valueChanges();

  constructor(private service: FlightService) {}

  add() {
    this.service.add(this.form.value);
  }
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


### valueChanges

```typescript
service.valueChanges(); // All document of the collection
service.valueChanges('id'); // Documents with id "id"
service.valueChanges([ '1', '2' ]); // Two documents with the ids specified
service.valueChanges([ where('key', '==', value) ]); // All documents where "key" is value
```

⚠️⚠️ 

#### About `where` & `new Date()`
`ngfire` will memorize the query, but `new Date()` changes each time you trigger the query, so the query won't be memorized as expected.
Examples : 
- `where('createdAt', '<', new Date())`: Query will be trigger each time this is call.
- `where('createdAt', '<', nextMinute(new Date()))`: Query is cached for the next minute.
- `where('createdAt', '<', nextDay(new Date()))`: Query is cached for the current user session.

⚠️⚠️


### load
```typescript
service.load();
service.load('id');
service.load([ '1', '2' ]);
service.load([ where('key', '==', value) ]);
```

### getValue
```typescript
service.getValue();
service.getValue('id');
service.getValue([ '1', '2' ]);
service.getValue([ where('key', '==', value) ]);
```

### add
```typescript
const id = await service.add({  });
const ids = await service.add([{  }, {  }]);
```

### update
```typescript
// Implicit id: idKey specified in the service should be in the document to update
await service.update({ id: '1', list: arrayUnion(42) });
await service.update([ { id: '1', age: 42 }, { id: '2', age: 24 } ]);

// Explicit id: 
await service.update('1', { list: arrayUnion(42) });
await service.update(['1', '2'], { name: 42 }); // each document is updated the same way

// Transaction
await service.update('1', (doc, tx) => ({ age: doc.age + 1 }));
await service.update(['1', '2'], (doc, tx) => ({ age: doc.age + 1 }));
```

### upsert
```typescript
const id = await service.upsert({ id: '1', list: arrayUnion(42) })
const ids = await service.upsert([
  { id: '1', age: 42 }, // If document exist in firestore: fallbacks to `add`
  { age: 24 },          // No id provided: fallbacks to `update`
])
```

### remove
```typescript
await service.remove('1');
await service.remove(['1', '2']);
```

### removeAll
```typescript
await service.removeAll();
```

## Batch & Transaction
Every write operation (`add`, `upsert`, `update`, `remove`, `removeAll`) support the `write` options for batches & transactions.

### Batch
This snippet will create a document and add the id to the `members` map of the other document with status "pending".
If one of the write operation fails, both fail.
```typescript
const batch = service.batch();
const id = await service.add({ age: 42 }, { write: batch });
await service.update('1', { `members.${id}`: 'pending' }, { write: batch })
await batch.commit();
```

### Transaction
Regular transaction:
```typescript
service.runTransaction(async (tx) => {
  const ref = service.getRef('1');
  const data = await tx.get(ref).then(snap => snap.data());
  return service.update('1', { age: data.age + 1 }, { write: tx });
})
```

Update transaction: 
```typescript
// Simple increment
service.update('1', doc => ({ age: doc.age + 1 }));

// Trigger side effect safely
service.update('id1', (doc, tx) => {
  const newAge = doc.age + 1;
  if (newAge > 25) {
    service.update('id2', { 'members.id1': deleteField() }, { write: tx });
  }
  return { age: newAge };
});
```



## Subcollection Service
To access a subcollection you can extend the `FireSubcollection` service:
```typescript
@Injectable({ providedIn: 'root' })
export class TicketService extends FireSubcollection<Ticket> {
  readonly path = 'flights/:flightId/tickets';
  // Field to be used for the document id (default: id)
  override readonly idKey = 'ticketId';
  // Field to be used for the full path reference (default: path)
  override readonly pathKey = 'refPath';
}
```

The service extends `FireCollection` with additional features:

### Query Collection Group
By default the subcollection will query the `collectionGroup`:
```typescript
// Query all documents inside a collection with name "tickets"
service.valueChanges();
service.valueChanges([where('status', '==', 'cancelled')]);
```

### Query a sub collection
Add an object with the value of the params as last argument:
```typescript
service.valueChanges({ flightId: 'AZ301' });
service.valueChanges('001', { flightId: 'AZ301' }); // 001 beeing the ticketId
service.valueChanges([where('status', '==', 'cancelled')], { flightId: 'AZ301' });
```

### Write on a sub collection
Add params as an field of the `WriteOption`:
```typescript
const params = { flightId: 'AZ301' };
service.add(ticket, { params });
service.update('001', ticket, { params }); // 001 beeing the ticketId
service.remove('001', { params });
```

Example using the batch: 
```typescript
const write = service.batch();
const params = { flightId: 'AZ301' };
await service.add(ticket, { params, write });
await service.update('001', ticket, { params, write });
await service.remove('002', { params, write });
write.commit();
```