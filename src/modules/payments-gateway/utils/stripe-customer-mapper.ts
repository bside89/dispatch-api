import {
  CreateCustomerDto,
  CreateCustomerShippingDto,
} from '@/modules/payments-gateway/dto/create-customer.dto';
import { PaymentCustomer } from '../types/customer.types';
import {
  StripeCustomer,
  StripeCustomerCreateParams,
  StripeCustomerCreateTaxIdType,
  StripeCustomerList,
  StripeCustomerListItem,
} from '../types/payments.types';

/**
 * Mapper class to convert between Stripe types and internal application types
 * related to customers. This class provides static methods to map data for creating
 * customers, as well as mapping Stripe customer objects to the internal
 * PaymentCustomer type used within the application.
 */
export class StripeCustomerMapper {
  static mapToStripeCustomerCreateParams(
    createCustomerDto: CreateCustomerDto,
  ): StripeCustomerCreateParams {
    return {
      address: this.mapToStripeAddress(createCustomerDto.address),
      balance: createCustomerDto.balance,
      business_name: createCustomerDto.businessName,
      cash_balance: createCustomerDto.cashBalance
        ? {
            settings: createCustomerDto.cashBalance.settings
              ? {
                  reconciliation_mode:
                    createCustomerDto.cashBalance.settings.reconciliationMode,
                }
              : undefined,
          }
        : undefined,
      description: createCustomerDto.description,
      email: createCustomerDto.email,
      individual_name: createCustomerDto.individualName,
      invoice_prefix: createCustomerDto.invoicePrefix,
      invoice_settings: createCustomerDto.invoiceSettings
        ? {
            custom_fields: createCustomerDto.invoiceSettings.customFields?.map(
              ({ name, value }) => ({ name, value }),
            ),
            default_payment_method:
              createCustomerDto.invoiceSettings.defaultPaymentMethod,
            footer: createCustomerDto.invoiceSettings.footer,
            rendering_options: createCustomerDto.invoiceSettings.renderingOptions
              ? {
                  amount_tax_display:
                    createCustomerDto.invoiceSettings.renderingOptions
                      .amountTaxDisplay,
                  template:
                    createCustomerDto.invoiceSettings.renderingOptions.template,
                }
              : undefined,
          }
        : undefined,
      metadata: createCustomerDto.metadata,
      name: createCustomerDto.name,
      next_invoice_sequence: createCustomerDto.nextInvoiceSequence,
      payment_method: createCustomerDto.paymentMethod,
      phone: createCustomerDto.phone,
      preferred_locales: createCustomerDto.preferredLocales,
      shipping: createCustomerDto.shipping
        ? {
            address: this.mapToStripeShippingAddress(
              createCustomerDto.shipping.address,
            ),
            name: createCustomerDto.shipping.name,
            phone: createCustomerDto.shipping.phone,
          }
        : undefined,
      source: createCustomerDto.source,
      tax: createCustomerDto.tax
        ? {
            ip_address: createCustomerDto.tax.ipAddress,
            validate_location: createCustomerDto.tax.validateLocation,
          }
        : undefined,
      tax_exempt: createCustomerDto.taxExempt,
      tax_id_data: createCustomerDto.taxIdData?.map(({ type, value }) => ({
        type: type as StripeCustomerCreateTaxIdType,
        value,
      })),
      test_clock: createCustomerDto.testClock,
      validate: createCustomerDto.validate,
    };
  }

  static mapToStripeAddress(
    address?: CreateCustomerDto['address'],
  ): StripeCustomerCreateParams['address'] {
    if (!address) {
      return undefined;
    }

    return {
      city: address.city,
      country: address.country,
      line1: address.line1,
      line2: address.line2,
      postal_code: address.postalCode,
      state: address.state,
    };
  }

  static mapToStripeShippingAddress(
    address: CreateCustomerShippingDto['address'],
  ): Exclude<NonNullable<StripeCustomerCreateParams['shipping']>, ''>['address'] {
    return {
      city: address.city,
      country: address.country,
      line1: address.line1,
      line2: address.line2,
      postal_code: address.postalCode,
      state: address.state,
    };
  }

  static mapToPaymentCustomerList(customers: StripeCustomerList): PaymentCustomer[] {
    return customers.map((customer) => this.mapToPaymentCustomer(customer));
  }

  static mapToPaymentCustomer(
    customer: StripeCustomer | StripeCustomerListItem,
  ): PaymentCustomer {
    return {
      id: customer.id,
      email: customer.email,
      name: customer.name ?? null,
      businessName: customer.business_name ?? null,
      individualName: customer.individual_name ?? null,
      phone: customer.phone ?? null,
      description: customer.description,
      balance: customer.balance,
      invoicePrefix: customer.invoice_prefix ?? null,
      defaultPaymentMethodId:
        typeof customer.invoice_settings.default_payment_method === 'string'
          ? customer.invoice_settings.default_payment_method
          : (customer.invoice_settings.default_payment_method?.id ?? null),
      preferredLocales: customer.preferred_locales ?? [],
      metadata: customer.metadata,
      taxExempt: customer.tax_exempt ?? null,
      address: customer.address
        ? {
            city: customer.address.city ?? null,
            country: customer.address.country ?? null,
            line1: customer.address.line1 ?? null,
            line2: customer.address.line2 ?? null,
            postalCode: customer.address.postal_code ?? null,
            state: customer.address.state ?? null,
          }
        : null,
      shipping: customer.shipping
        ? {
            address: customer.shipping.address
              ? {
                  city: customer.shipping.address.city ?? null,
                  country: customer.shipping.address.country ?? null,
                  line1: customer.shipping.address.line1 ?? null,
                  line2: customer.shipping.address.line2 ?? null,
                  postalCode: customer.shipping.address.postal_code ?? null,
                  state: customer.shipping.address.state ?? null,
                }
              : null,
            name: customer.shipping.name,
            phone: customer.shipping.phone ?? null,
          }
        : null,
      taxIds:
        customer.tax_ids?.data.map((taxId) => ({
          id: taxId.id,
          type: taxId.type,
          value: taxId.value,
        })) ?? [],
      createdAt: new Date(customer.created * 1000),
      livemode: customer.livemode,
    };
  }
}
