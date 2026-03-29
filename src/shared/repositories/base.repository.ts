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

  async findOneWithRelations(
    params: Partial<T>,
    relations: string[],
    select?: (keyof T)[],
  ): Promise<T> {
    const manager = this.getManager();
    if (select) {
      return manager.findOne(this.repository.target, {
        where: params,
        relations,
        select,
      } as any);
    }
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

  async count(): Promise<number> {
    const manager = this.getManager();
    return manager.count(this.repository.target);
  }

  // Method to get the manager of a transaction dynamically
  protected getManager(): EntityManager {
    return TransactionContext.getManager() || this.repository.manager;
  }

  // Method to create a query builder for more complex queries
  protected createQueryBuilder(alias: string): SelectQueryBuilder<T> {
    const manager = this.getManager();
    return manager.createQueryBuilder(this.repository.target, alias);
  }
}
