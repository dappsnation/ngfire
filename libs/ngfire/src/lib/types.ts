import type { FieldValue, Transaction, WriteBatch } from "firebase/firestore";

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
  updatedAt?: Date;
}

export type Params = Record<string, string>;


type Join<K extends string, P extends string> = '' extends P ? K : `${K}.${P}`;

type GetKey<T, K extends Extract<keyof T, string>> = 
  // eslint-disable-next-line @typescript-eslint/ban-types
  T[K] extends Function ? never
  : K | Join<K, DeepKeys<T[K]>>

export type DeepKeys<T> =
  T extends Date ? ''
  : T extends Array<any> ? ''
  : T extends Record<string, any> ? { [K in Extract<keyof T, string>]: GetKey<T, K> }[Extract<keyof T, string>]
  : '';


type DeepValue<T, K> =
  K extends `${infer I}.${infer J}` ? (I extends keyof T ? DeepValue<T[I], J> : never)
  : K extends keyof T ? T[K] : never;


export type DeepEntity<T> = Partial<{
  [key in DeepKeys<T>]: DeepValue<T, key> | FieldValue;
}>

export type FireEntity<T> = DeepEntity<T> & DeepEntity<{ _meta: MetaDocument }>;
