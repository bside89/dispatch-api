import {
  Repository,
  SelectQueryBuilder,
  DeepPartial,
  DeleteResult,
  UpdateResult,
  EntityManager,
  FindOptionsWhere,
  QueryDeepPartialEntity,
} from 'typeorm';
import { TransactionContext } from '../utils/transaction-context';
import { BaseEntity } from '../entities/base.entity';

interface QueryOptions<T> {
  where: Partial<T>;
  select?: (keyof T)[];
  relations?: string[];
}

export abstract class BaseRepository<T extends BaseEntity> {
  protected constructor(protected readonly repository: Repository<T>) {}

  createEntity(entityData: Partial<T>): T {
    const manager = this.getManager();
    return manager.create(this.repository.target, entityData as DeepPartial<T>);
  }

  async preload(entityData: Partial<T>): Promise<T> {
    const manager = this.getManager();
    return manager.preload(this.repository.target, entityData as DeepPartial<T>);
  }

  async findAll(): Promise<T[]> {
    const manager = this.getManager();
    return manager.find(this.repository.target);
  }

  async findById(
    id: string,
    params: Omit<QueryOptions<T>, 'where'> = {},
  ): Promise<T> {
    return this.findOne({ where: { id } as Partial<T>, ...params });
  }

  async findOne(params: QueryOptions<T>): Promise<T> {
    const manager = this.getManager();

    // If select are not provided, include all columns by default
    const select =
      params.select ??
      this.repository.metadata.columns.map((col) => col.propertyName as keyof T);

    return manager.findOne(this.repository.target, {
      where: params.where as FindOptionsWhere<T>,
      select,
      ...(params.relations && { relations: params.relations }),
    });
  }

  async save(entity: T): Promise<T> {
    const manager = this.getManager();
    return manager.save(entity);
  }

  async saveBulk(entities: T[]): Promise<T[]> {
    if (entities.length === 0) return [];
    const manager = this.getManager();
    return manager.save(entities);
  }

  async update(id: string, updateData: Partial<T>): Promise<UpdateResult> {
    const manager = this.getManager();
    return manager.update(
      this.repository.target,
      id,
      updateData as QueryDeepPartialEntity<T>,
    );
  }

  async delete(criteria: Partial<T>): Promise<DeleteResult> {
    const manager = this.getManager();
    return manager.delete(this.repository.target, criteria);
  }

  async deleteById(id: string): Promise<DeleteResult> {
    const manager = this.getManager();
    return manager.delete(this.repository.target, id);
  }

  async deleteBulk(ids: string[]): Promise<DeleteResult> {
    if (ids.length === 0) return null;
    const manager = this.getManager();
    return manager.delete(this.repository.target, ids);
  }

  async existsBy(params: { where: Partial<T> }): Promise<boolean> {
    const manager = this.getManager();
    const count = await manager.count(this.repository.target, {
      where: params.where as FindOptionsWhere<T>,
    });
    return count > 0;
  }

  async count(): Promise<number> {
    const manager = this.getManager();
    return manager.count(this.repository.target);
  }

  /**
   * Gets the EntityManager for the current transaction context or the default
   * repository manager.
   * @returns The EntityManager instance.
   */
  protected getManager(): EntityManager {
    return TransactionContext.getManager() || this.repository.manager;
  }

  /**
   * Creates a query builder for the current entity.
   * @param alias The alias to use for the entity in the query.
   * @returns A SelectQueryBuilder instance for the entity.
   */
  protected createQueryBuilder(alias: string): SelectQueryBuilder<T> {
    const manager = this.getManager();
    return manager.createQueryBuilder(this.repository.target, alias);
  }
}
