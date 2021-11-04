import type { Transaction, WriteBatch } from "firebase/firestore";

export type AtomicWrite = Transaction | WriteBatch;
export interface WriteOptions {
  write?: AtomicWrite;
  ctx?: any;
  params?: Params;
}

export type UpdateCallback<E> = (
  entity: Readonly<E>,
  tx?: Transaction
) => Partial<E> | Promise<Partial<E>>;

export interface MetaDocument {
  createdAt: Date;
  modifiedAt: Date;
}

export type Params = Record<string, string>;