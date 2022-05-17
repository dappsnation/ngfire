import { Component } from '@angular/core';
import { ReplaySubject, switchMap } from 'rxjs';
import { TokenList } from './list';

@Component({
  selector: 'ngfire-database',
  templateUrl: './database.component.html',
  styleUrls: ['./database.component.scss']
})
export class DatabaseComponent {
  private selected = new ReplaySubject<string>();
  tokens$ = this.tokenList.valueChanges({ contract: 'Hello' });
  selected$ = this.selected.asObservable().pipe(
    switchMap(id => this.tokenList.valueChanges(id, { contract: 'Hello' }))
  );
  constructor(private tokenList: TokenList) { }

  select(id: string) {
    this.selected.next(id);
  }

  add() {
    this.tokenList.add({ tokenId: '1', created: new Date() }, { contract: 'Hello' })
  }

  remove(key: string) {
    this.tokenList.remove(key, { contract: 'Hello' });
  }
}
