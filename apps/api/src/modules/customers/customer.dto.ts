export class CreateCustomerDto {
  code!: string;
  name!: string;
  phone?: string;
  address?: string;
  carrierName?: string;
  carrierPhone?: string;
  group?: string;
  region?: string;
}
export class UpdateCustomerDto {
  name?: string;
  phone?: string;
  address?: string;
  carrierName?: string;
  carrierPhone?: string;
  group?: string;
  region?: string;
  status?: string;
}
