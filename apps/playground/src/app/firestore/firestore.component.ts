import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { limit, where } from 'firebase/firestore';
import { FlightService } from './service';

@Component({
  selector: 'ngfire-firestore',
  templateUrl: './firestore.component.html',
  styleUrls: ['./firestore.component.scss']
})
export class FirestoreComponent {
  form = new FormGroup({
    number: new FormControl(),
    info: new FormControl()
  });
  flight$ = this.flightService.valueChanges([where('number', '<', 10), limit(3)]);

  constructor(private flightService: FlightService) {}

  add() {
    this.flightService.add({...this.form.value, createdAt: new Date()});
  }
}
