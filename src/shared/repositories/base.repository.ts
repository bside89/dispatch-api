import {
  Repository,
  SelectQueryBuilder,
  DeepPartial,
  DeleteResult,
  UpdateResult,
  EntityManager,
} from 'typeorm';
import { TransactionContext } from '../utils/transaction-context';

export abstract class BaseRepository<T> {
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

  async findById(id: any, select?: (keyof T)[]): Promise<T> {
    const manager = this.getManager();
    if (select) {
      return manager.findOne(this.repository.target, {
        where: { id },
        select,
      } as any);
    }
    return manager.findOne(this.repository.target, { where: { id } } as any);
  }

  async findOneWhere(params: Partial<T>, select?: (keyof T)[]): Promise<T> {
    const manager = this.getManager();
    if (select) {
      return manager.findOne(this.repository.target, {
        where: params,
        select,
      } as any);
    }
    return manager.findOne(this.repository.target, { where: params } as any);
  }

  /**
   * Finds a single entity matching the given parameters and selects all columns.
   * @param params The parameters to filter the entity.
   * @returns The found entity or null if not found.
   * @remarks This method is useful when you want to ensure that all columns of the
   * entity are selected, regardless of any default select options defined in the
   * entity metadata.
   */
  async findOneCompleteWhere(params: Partial<T>): Promise<T> {
    const manager = this.getManager();
    const select = this.repository.metadata.columns.map(
      (col) => col.propertyName as keyof T,
    );
    return manager.findOne(this.repository.target, {
      where: params,
      select,
    } as any);
  }

  async findOneWithRelations(params: Partial<T>): Promise<T> {
    const manager = this.getManager();
    const relations = this.repository.metadata.relations.map(
      (rel) => rel.propertyName,
    );
    return manager.findOne(this.repository.target, {
      where: params,
      relations,
    } as any);
  }

  async save(entity: T): Promise<T> {
    const manager = this.getManager();
    return manager.save(entity);
  }

  async saveMany(entities: T[]): Promise<T[]> {
    if (entities.length === 0) return null;
    const manager = this.getManager();
    return manager.save(entities);
  }

  async update(id: any, updateData: Partial<T>): Promise<UpdateResult> {
    const manager = this.getManager();
    return manager.update(this.repository.target, id, updateData as any);
  }

  async delete(id: any): Promise<DeleteResult> {
    const manager = this.getManager();
    return manager.delete(this.repository.target, id);
  }

  async deleteMany(ids: string[]): Promise<DeleteResult> {
    if (ids.length === 0) return null;
    const manager = this.getManager();
    return manager.delete(this.repository.target, ids);
  }

  async existsBy(params: Partial<T>): Promise<boolean> {
    const manager = this.getManager();
    const count = await manager.count(this.repository.target, {
      where: params as any,
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
