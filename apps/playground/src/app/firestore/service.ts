import { Injectable } from '@angular/core';
import { FireCollection } from 'ngfire';

export interface Flight {
  id: string;
  number: string;
  info: string;
}

@Injectable({ providedIn: 'root' })
export class FlightService extends FireCollection<Flight> {
  override memorize = true;
  readonly path = 'flights';
  readonly idKey = 'id';
}