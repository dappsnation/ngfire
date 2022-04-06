import { Component } from '@angular/core';
import { TokenList } from './list';

@Component({
  selector: 'ngfire-database',
  templateUrl: './database.component.html',
  styleUrls: ['./database.component.scss']
})
export class DatabaseComponent {
  tokens$ = this.tokenList.valueChanges({ contract: 'Hello' });
  constructor(private tokenList: TokenList) { }

  add() {
    this.tokenList.add({ tokenId: '1', created: new Date() }, { contract: 'Hello' })
  }

  remove(key: string) {
    this.tokenList.remove(key, { contract: 'Hello' });
  }
}
