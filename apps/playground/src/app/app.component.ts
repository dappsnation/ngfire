import { Component } from '@angular/core';
import { Subscription } from 'rxjs';
import { Firestore } from './firestore.service';

@Component({
  selector: 'ngfire-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  sub: Subscription;
  data$ = this.firestore.valueChanges('tests/0', ref => ref.where('data', '==', 'name'));
  constructor(private firestore: Firestore) {
    this.sub = this.data$.subscribe(console.log);
  }

  unsubscribe() {
    this.sub.unsubscribe();
  }
}
