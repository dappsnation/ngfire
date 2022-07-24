/** Used to get all the arguments of the initilizers except first one */
export type FirebaseParams<T extends (...args: any) => any> = T extends (arg0: any, ...args: infer P) => any ? P : never
