import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Firestore } from './firestore.service';

@Component({
  selector: 'ngfire-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  sub?: Subscription;
  form = new FormGroup({ data: new FormControl() })
  data$ = this.firestore.valueChanges('tests', ref => ref.where('data', '==', 'name'));
  constructor(private firestore: Firestore) {
    this.sub = this.data$.subscribe(console.log);
    this.firestore.getValue('tests/aQ7DafGYHyoAlrSUPsAT', { expands: ['ref', 'array'] }).then(console.log);
  }

  unsubscribe() {
    this.sub?.unsubscribe();
  }

  save(data: any) {
    this.firestore.setDoc('tests', data);
  }
}
