import {Context} from './context';
import {BaseModel} from './model';
import type {Edge, FilterOp, OrderDirection, Query} from './query';
import type {Opt, OptionalId, RequireOnlyId, Success} from './utils';

// WIP
export type Transaction = any;
export type RunWithTransactionCallback<T = void> = (
  transaction: Transaction,
) => Promise<T>;

export interface Repo<T extends BaseModel> {
  create(m: OptionalId<T>): Promise<T>;
  get(id: string, edges?: Edge<T>[]): Promise<Opt<T>>;
  query(q?: Query<T>): RepoQuery<T>;
  delete(id: string): Promise<Success>;
  update(m: RequireOnlyId<T>): Promise<T>;
  useTransaction(txn: Transaction): Repo<T>;
  useContext(ctx: Context): Repo<T>;
  // inTransaction(): boolean;
  // getContext(): Opt<Context>;
}

export interface RepoQuery<T extends BaseModel> {
  filter(field: keyof T, op: FilterOp, value: any): this;
  order(field: keyof T, dir: OrderDirection): this;
  limit(limit: number, offset?: number): this;
  run(edges?: Edge<T>[]): Promise<T[]>;
}
export type RepoOptions = {
  ctx?: Context;
  transaction?: Transaction;
};
