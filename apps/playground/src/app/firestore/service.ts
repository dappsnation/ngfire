import { Injectable } from '@angular/core';
import { FireCollection } from 'ngfire';

export interface Flight {
  id: string;
  number: string;
  info: string;
  createdAt: Date;
}

@Injectable({ providedIn: 'root' })
export class FlightService extends FireCollection<Flight> {
  override memorize = true;
  override delayToUnsubscribe = 10000;
  readonly path = 'flights';
  readonly idKey = 'id';
}