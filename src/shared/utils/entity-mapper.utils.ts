import { ClassConstructor, plainToInstance } from 'class-transformer';

export class EntityMapper {
  /**
   * Maps an entity to a DTO.
   * @param entity The entity to map.
   * @param DtoClass The DTO class to map to.
   * @returns The mapped DTO.
   */
  static map<TDto>(entity: object, DtoClass: ClassConstructor<TDto>): TDto {
    return plainToInstance(DtoClass, entity, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * Maps an array of entities to an array of DTOs.
   * @param entities The array of entities to map.
   * @param DtoClass The DTO class to map to.
   * @returns The array of mapped DTOs.
   */
  static mapArray<TDto>(
    entities: object[],
    DtoClass: ClassConstructor<TDto>,
  ): TDto[] {
    return entities.map((entity) => EntityMapper.map(entity, DtoClass));
  }
}
