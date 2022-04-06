import { Injectable } from '@angular/core';
import { ExtractDeepKeys, FireList } from 'ngfire';

interface Token {
  key: string;
  path: string;
  tokenId: string;
  amount: number;
  created: Date;
}

@Injectable({ providedIn: 'root' })
export class TokenList extends FireList<Token> {
  readonly path = ':contract/tokens';
  override readonly idKey = 'key';
  override readonly pathKey = 'path';
  dateKeys: ExtractDeepKeys<Token, Date>[] = ['created']
}