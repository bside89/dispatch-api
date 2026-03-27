import {
  Repository,
  SelectQueryBuilder,
  DeepPartial,
  DeleteResult,
  UpdateResult,
} from 'typeorm';

export abstract class BaseRepository<T> {
  protected constructor(protected readonly repository: Repository<T>) {}

  createEntity(entityData: Partial<T>): T {
    return this.repository.create(entityData as DeepPartial<T>);
  }

  async findAll(): Promise<T[]> {
    return this.repository.find();
  }

  async findById(id: any, select?: (keyof T)[]): Promise<T> {
    if (select) {
      return this.repository.findOne({ where: { id }, select } as any);
    }
    return this.repository.findOne({ where: { id } } as any);
  }

  async findOneWhere(params: Partial<T>, select?: (keyof T)[]): Promise<T> {
    if (select) {
      return this.repository.findOne({ where: params, select } as any);
    }
    return this.repository.findOne({ where: params } as any);
  }

  async findOneWithRelations(
    params: Partial<T>,
    relations: string[],
    select?: (keyof T)[],
  ): Promise<T> {
    if (select) {
      return this.repository.findOne({
        where: params,
        relations,
        select,
      } as any);
    }
    return this.repository.findOne({ where: params, relations } as any);
  }

  async save(entity: T): Promise<T> {
    return this.repository.save(entity);
  }

  async saveMany(entities: T[]): Promise<T[]> {
    return this.repository.save(entities);
  }

  async update(id: any, updateData: Partial<T>): Promise<UpdateResult> {
    return this.repository.update(id, updateData as any);
  }

  async delete(id: any): Promise<DeleteResult> {
    return this.repository.delete(id);
  }

  async count(): Promise<number> {
    return this.repository.count();
  }

  // Method to create a query builder for more complex queries
  protected createQueryBuilder(alias: string): SelectQueryBuilder<T> {
    return this.repository.createQueryBuilder(alias);
  }
}
