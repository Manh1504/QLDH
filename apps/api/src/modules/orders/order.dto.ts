export interface OrderItemInput {
  variantId?: string; // có mã kho
  productName?: string; color?: string; size?: string; // dòng nhập tay
  warehouse?: string; // KhoXuat, mặc định KHO_CHINH
  qty: number; unitPrice: number; saleType?: string; imageUrl?: string; note?: string;
}
export class CreateOrderDto {
  code?: string; // trống = server tự sinh lúc ghi DB (chống 2 req trùng mã)
  customerId!: string;
  type?: string;
  urgent?: boolean;
  orderDate?: string;
  shipDate?: string;
  note?: string;
  customerNote?: string;
  staffNote?: string;
  items!: OrderItemInput[];
}
export class TransitionDto { to!: string; note?: string; actorId!: string; }
