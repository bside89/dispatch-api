export class CreatePgwCustomerMetadataDto {
  userId: string;
}

export class CreatePgwCustomerAddressDto {
  city?: string;

  country?: string;

  line1?: string;

  line2?: string;

  postalCode?: string;

  state?: string;
}

export class CreatePgwCustomerDto {
  email: string;

  name: string;

  address?: CreatePgwCustomerAddressDto;

  metadata?: CreatePgwCustomerMetadataDto;

  idempotencyKey: string;
}
