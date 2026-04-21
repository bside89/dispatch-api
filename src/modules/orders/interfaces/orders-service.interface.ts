import { PagOffsetResultDto } from '@/shared/dto/pag-offset-result.dto';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { OrderQueryDto } from '../dto/order-query.dto';
import { ShipOrderDto } from '../dto/ship-order.dto';
import { OrderByUserQueryDto } from '../dto/order-by-user-query.dto';
import { OrderResponseDto, PublicOrderResponseDto } from '../dto/order-response.dto';
import type { RequestUser } from '@/modules/auth/interfaces/request-user.interface';
import { IBaseService } from '@/shared/services/base-service.interface';
import { PaymentIntentUpdateDto } from '../dto/payment-intent-update.dto';

export interface IOrdersService extends IBaseService {
  publicCreate(
    dto: CreateOrderDto,
    userId: string,
    idempotencyKey: string,
  ): Promise<PublicOrderResponseDto>;

  publicFindByUser(
    queryDto: OrderByUserQueryDto,
    userId: string,
  ): Promise<PagOffsetResultDto<PublicOrderResponseDto>>;

  publicFindOne(
    id: string,
    requestUser: RequestUser,
  ): Promise<PublicOrderResponseDto>;

  adminFindAll(
    queryDto: OrderQueryDto,
  ): Promise<PagOffsetResultDto<OrderResponseDto>>;

  adminFindOne(id: string): Promise<OrderResponseDto>;

  adminUpdate(id: string, dto: UpdateOrderDto): Promise<OrderResponseDto>;

  adminRemove(id: string): Promise<void>;

  markPaymentAsSucceeded(dto: PaymentIntentUpdateDto): Promise<OrderResponseDto>;

  markPaymentAsFailed(dto: PaymentIntentUpdateDto): Promise<OrderResponseDto>;

  ship(id: string, dto: ShipOrderDto): Promise<OrderResponseDto>;

  deliver(id: string): Promise<OrderResponseDto>;

  cancel(id: string): Promise<void>;

  refund(id: string): Promise<void>;
}
