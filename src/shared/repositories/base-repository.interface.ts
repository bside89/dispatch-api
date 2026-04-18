import { DeleteResult, UpdateResult } from 'typeorm';
import { BaseEntity } from '../entities/base.entity';

export interface QueryOptions<T> {
  where: Partial<T>;
  select?: (keyof T)[];
  relations?: string[];
}

export interface IBaseRepository<T extends BaseEntity> {
  createEntity(entityData: Partial<T>): T;

  preload(entityData: Partial<T>): Promise<T>;

  findAll(): Promise<T[]>;

  findById(id: string, params?: Omit<QueryOptions<T>, 'where'>): Promise<T>;

  findOne(params: QueryOptions<T>): Promise<T>;

  save(entity: T): Promise<T>;

  saveBulk(entities: T[]): Promise<T[]>;

  update(id: string, updateData: Partial<T>): Promise<UpdateResult>;

  delete(criteria: Partial<T>): Promise<DeleteResult>;

  deleteById(id: string): Promise<DeleteResult>;

  deleteBulk(ids: string[]): Promise<DeleteResult>;

  softDelete(entity: T): Promise<UpdateResult>;

  existsBy(params: { where: Partial<T> }): Promise<boolean>;

  count(): Promise<number>;
}
