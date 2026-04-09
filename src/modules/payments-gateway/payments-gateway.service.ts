import { BaseService } from '@/shared/services/base.service';
import { Injectable } from '@nestjs/common';
import { StripeCustomersGateway } from './gateways/stripe-customers.gateway';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';
import { EntityMapper } from '@/shared/utils/entity-mapper';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class PaymentsGatewayService extends BaseService {
  constructor(private readonly stripeCustomersGateway: StripeCustomersGateway) {
    super(PaymentsGatewayService.name);
  }

  //#region Customers

  async customersCreate(
    createCustomerDto: CreateCustomerDto,
  ): Promise<CustomerResponseDto> {
    const customer = await this.stripeCustomersGateway.create(createCustomerDto);
    return EntityMapper.map(customer, CustomerResponseDto);
  }

  async customersList(): Promise<CustomerResponseDto[]> {
    const customers = await this.stripeCustomersGateway.list();
    return EntityMapper.mapArray(customers, CustomerResponseDto);
  }

  async customersRetrieve(customerId: string): Promise<CustomerResponseDto> {
    const customer = await this.stripeCustomersGateway.retrieve(customerId);
    return EntityMapper.map(customer, CustomerResponseDto);
  }

  async customersUpdate(
    customerId: string,
    updateCustomerDto: UpdateCustomerDto,
  ): Promise<CustomerResponseDto> {
    const updatedCustomer = await this.stripeCustomersGateway.update(
      customerId,
      updateCustomerDto,
    );
    return EntityMapper.map(updatedCustomer, CustomerResponseDto);
  }

  async customersDelete(customerId: string): Promise<void> {
    await this.stripeCustomersGateway.delete(customerId);
  }

  //#endregion
}
