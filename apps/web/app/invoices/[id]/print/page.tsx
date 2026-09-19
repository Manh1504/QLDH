'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../lib/api-client';

export default function PrintInvoice() {
  const { id } = useParams() as { id: string };
  const { data: v } = useQuery({ queryKey: ['inv', id], queryFn: () => api(`/invoices/${id}`) });
  if (!v) return <div style={{ padding: 24 }}>Đang tải...</div>;
  return (
    <div style={{ padding: 32, maxWidth: 640, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ textAlign: 'center' }}>HÓA ĐƠN BÁN HÀNG</h1>
      <p>Mã đơn: <b>{v.order?.code}</b> | Ngày: {new Date(v.createdAt).toLocaleString('vi-VN')}</p>
      <p>Khách: <b>{v.order?.customer?.name}</b></p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }} border={1} cellPadding={8}>
        <thead><tr><th>Sản phẩm</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
        <tbody>{(v.order?.items || []).map((item: any) => <tr key={item.id}><td>{item.variant?.internalCode || item.productName}</td><td>{item.qty}</td><td>{Number(item.unitPrice).toLocaleString('vi-VN')}</td><td>{(item.qty * Number(item.unitPrice)).toLocaleString('vi-VN')}</td></tr>)}</tbody>
      </table>
      <p><b>Tổng tiền:</b> {Number(v.total).toLocaleString('vi-VN')} | <b>Đã trả:</b> {Number(v.paid).toLocaleString('vi-VN')} | <b>Còn lại:</b> {(Number(v.total) - Number(v.paid)).toLocaleString('vi-VN')}</p>
      <p>Trạng thái: {v.status}</p>
      <button onClick={() => window.print()}>In / Lưu PDF</button>
    </div>
  );
}
