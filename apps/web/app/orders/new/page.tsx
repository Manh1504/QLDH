'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { uploadImage } from '../../../lib/upload';
import { vi } from '../../../lib/status';
import { Field } from '../../../components/Field';
import { Guard } from '../../../components/Shell';

interface Row {
  mode: 'kho' | 'tay';
  q: string; // ô tìm mã
  variantId: string; label: string; avail: number;
  productName: string; color: string; size: string;
  qty: string; unitPrice: string; warehouse: string; saleType: string; imageUrl: string; note: string;
}

const blankRow = (): Row => ({ mode: 'kho', q: '', variantId: '', label: '', avail: 0, productName: '', color: '', size: '', qty: '1', unitPrice: '0', warehouse: 'KHO_CHINH', saleType: '', imageUrl: '', note: '' });

export default function NewOrderPage() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState('');
  const [cq, setCq] = useState('');
  const [newCust, setNewCust] = useState({ name: '', phone: '', address: '', carrierName: '', carrierPhone: '' });
  const [type, setType] = useState('TAN_XUAN');
  const [urgent, setUrgent] = useState(false);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [shipDate, setShipDate] = useState('');
  const [noteKH, setNoteKH] = useState('');
  const [noteNV, setNoteNV] = useState('');
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [files, setFiles] = useState<File[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const customers = useQuery({ queryKey: ['cust-search', cq], queryFn: () => api(`/customers?sortBy=name&q=${encodeURIComponent(cq)}&pageSize=10`), enabled: cq.length >= 1 });
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const total = rows.reduce((s, r) => s + Number(r.qty || 0) * Number(r.unitPrice || 0), 0);

  async function submit() {
    setMsg('');
    let cid = customerId;
    if (!cid) {
      // Không chọn khách cũ -> tạo khách mới tại chỗ (mã KH tự sinh)
      if (!newCust.name.trim()) return setMsg('Chưa chọn khách cũ và chưa nhập tên khách mới');
      try {
        const c = await api('/customers', { method: 'POST', body: JSON.stringify({ code: `KH${Date.now()}`, ...newCust, name: newCust.name.trim(), phone: newCust.phone.trim() || undefined }) });
        cid = c.id;
      } catch (e: any) { return setMsg(e.message); }
    }
    const items = [];
    for (const r of rows) {
      const qty = Number(r.qty), price = Number(r.unitPrice);
      if (!qty || qty <= 0) return setMsg('Số lượng phải > 0');
      if (r.mode === 'kho' && !r.variantId) return setMsg('Có dòng kho chưa chọn mã hàng');
      if (r.mode === 'tay' && !r.productName) return setMsg('Có dòng tay chưa nhập tên SP');
      items.push(r.mode === 'kho'
        ? { variantId: r.variantId, qty, unitPrice: price, warehouse: r.warehouse, saleType: r.saleType, imageUrl: r.imageUrl, note: r.note }
        : { productName: r.productName, color: r.color, size: r.size, qty, unitPrice: price, warehouse: r.warehouse, saleType: r.saleType, imageUrl: r.imageUrl, note: r.note });
    }
    if (!items.length) return setMsg('Chưa có dòng hàng');
    setBusy(true);
    try {
      const o = await api('/orders', { method: 'POST', body: JSON.stringify({ customerId: cid, type, urgent, orderDate, shipDate: shipDate || undefined, customerNote: noteKH || undefined, staffNote: noteNV || undefined, items }) });
      for (const f of files) {
        const { url, thumbnailUrl } = await uploadImage(f);
        await api(`/orders/${o.id}/images`, { method: 'POST', body: JSON.stringify({ url, thumbnailUrl }) });
      }
      router.push(`/orders/${o.id}`);
    } catch (e: any) { setMsg(e.message); setBusy(false); }
  }

  return (
    <Guard>
      <h1>Tạo đơn hàng</h1>
      <div className="card">
        <h3>Thông tin chung</h3>
        <div className="row">
          <Field label="Mã đơn"><b style={{ padding: '9px 0' }}>Tự sinh khi bấm Lưu</b></Field>
          <Field label="Ngày tạo"><input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></Field>
          <Field label="Loại đơn"><select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="TAN_XUAN">Tân Xuân</option><option value="CA_KOI">Cá Koi</option>
            <option value="TAN_XUAN_CA_KOI">Tân Xuân và Cá Koi</option><option value="KHACH_DAT">Khách đặt</option>
          </select></Field>
          <Field label="Ngày giao"><input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} /></Field>
          <Field label="Ưu tiên"><label className="row"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Đơn gấp</label></Field>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <Field label="Khách cũ (gõ tên/SĐT rồi bấm chọn)" style={{ flex: 1 }}><input placeholder="VD: Nguyễn Văn A / 090..." value={cq} onChange={(e) => setCq(e.target.value)} style={{ width: '100%' }} /></Field>
        </div>
        {(customers.data?.data || []).length > 0 && (
          <div className="row" style={{ marginTop: 8 }}>
            {(customers.data.data || []).map((c: any) => (
              <button key={c.id} className={customerId === c.id ? '' : 'ghost'} onClick={() => { setCustomerId(c.id); setCq(c.name); setNewCust({ name: '', phone: '', address: '', carrierName: '', carrierPhone: '' }); }}>{c.name} ({c.phone || '—'})</button>
            ))}
          </div>
        )}
        <div className="card" style={{ background: '#f8faff', marginTop: 8 }}>
          <h3>Không có khách cũ? Nhập khách mới tại đây {customerId && <span className="muted">(đang chọn khách cũ — <a href="#" onClick={(e) => { e.preventDefault(); setCustomerId(''); }}>bỏ chọn</a>)</span>}</h3>
          <div className="row">
            <Field label="Tên khách mới *"><input value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} /></Field>
           <Field label="SĐT khách mới"><input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} /></Field>
            <Field label="Địa chỉ"><input value={newCust.address} onChange={(e) => setNewCust({ ...newCust, address: e.target.value })} /></Field>
            <Field label="Chành xe"><input value={newCust.carrierName} onChange={(e) => setNewCust({ ...newCust, carrierName: e.target.value })} /></Field>
            <Field label="SĐT chành xe"><input value={newCust.carrierPhone} onChange={(e) => setNewCust({ ...newCust, carrierPhone: e.target.value })} /></Field>
          </div>
          <div className="muted">Mã KH tự sinh khi lưu. Bấm “Lưu đơn” là tạo khách + đơn cùng lúc.</div>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <Field label="Ghi chú của khách" style={{ flex: 1 }}><input value={noteKH} onChange={(e) => setNoteKH(e.target.value)} style={{ width: '100%' }} /></Field>
          <Field label="Ghi chú nội bộ" style={{ flex: 1 }}><input value={noteNV} onChange={(e) => setNoteNV(e.target.value)} style={{ width: '100%' }} /></Field>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>Dòng hàng ({rows.length})</h3>
          <button className="ghost" onClick={() => setRows([...rows, blankRow()])}>+ Thêm dòng</button>
        </div>
        {rows.map((r, i) => <ItemRow key={i} r={r} set={(p) => set(i, p)} del={() => setRows(rows.filter((_, j) => j !== i))} />)}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <b>Tổng: {total.toLocaleString('vi-VN')}</b>
        </div>
      </div>

      <div className="card">
        <h3>Ảnh đơn (Zalo / thực tế)</h3>
        <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        <div className="row" style={{ marginTop: 8 }}>
          {files.map((f, i) => <img key={i} src={URL.createObjectURL(f)} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 10 }} />)}
        </div>
      </div>

      {msg && <div className="err" style={{ marginBottom: 8 }}>{msg}</div>}
      <button onClick={submit} disabled={busy}>{busy ? 'Đang lưu...' : `Lưu đơn (${total.toLocaleString('vi-VN')})`}</button>
    </Guard>
  );
}

function ItemRow({ r, set, del }: { r: Row; set: (p: Partial<Row>) => void; del: () => void }) {
  const sug = useQuery({ queryKey: ['sug-row', r.q], queryFn: () => api(`/inventory/suggest?q=${encodeURIComponent(r.q)}`), enabled: r.mode === 'kho' && r.q.length >= 2 });
  return (
    <div className="card" style={{ background: '#f8faff' }}>
      <div className="row">
        <Field label="Kiểu dòng"><select value={r.mode} onChange={(e) => set({ mode: e.target.value as any, variantId: '', label: '' })}>
          <option value="kho">Có mã kho</option>
          <option value="tay">Nhập tay</option>
        </select></Field>
        <button className="danger" onClick={del} style={{ alignSelf: 'end' }}>Xóa dòng</button>
      </div>
      {r.mode === 'kho' ? (
        <>
          <div className="row" style={{ marginTop: 8 }}>
            <Field label="Tìm mã hàng (gõ ≥2 ký tự)" style={{ flex: 1 }}><input value={r.q} onChange={(e) => set({ q: e.target.value })} style={{ width: '100%' }} /></Field>
          </div>
          {(sug.data || []).length > 0 && !r.variantId && (
            <div style={{ marginTop: 6 }}>
              {(sug.data || []).slice(0, 6).map((v: any) => {
                const avail = (v.stocks || []).reduce((s: number, s2: any) => s + s2.onHand - s2.held, 0);
                return (
                  <div key={v.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>{v.internalCode} — {v.salesCode} — {v.color}/{v.size} (khả dụng {avail})</span>
                    <button className="ghost" onClick={() => set({ variantId: v.id, label: `${v.internalCode} ${v.color}/${v.size}`, avail, q: '' })}>Chọn</button>
                  </div>
                );
              })}
            </div>
          )}
          {r.variantId && <div className="muted">Đã chọn: <b>{r.label}</b> (khả dụng {r.avail}) <a href="#" onClick={(e) => { e.preventDefault(); set({ variantId: '', label: '' }); }}>đổi</a></div>}
        </>
      ) : (
        <div className="row" style={{ marginTop: 8 }}>
          <Field label="Tên sản phẩm *" style={{ flex: 1 }}><input value={r.productName} onChange={(e) => set({ productName: e.target.value })} style={{ width: '100%' }} /></Field>
          <Field label="Màu"><input value={r.color} onChange={(e) => set({ color: e.target.value })} style={{ width: 100 }} /></Field>
          <Field label="Size"><input value={r.size} onChange={(e) => set({ size: e.target.value })} style={{ width: 80 }} /></Field>
        </div>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <Field label="Số lượng"><input value={r.qty} onChange={(e) => set({ qty: e.target.value })} style={{ width: 80 }} /></Field>
        <Field label="Đơn giá (đ)"><input value={r.unitPrice} onChange={(e) => set({ unitPrice: e.target.value })} style={{ width: 120 }} /></Field>
        <Field label="Kho xuất"><input value={r.warehouse} onChange={(e) => set({ warehouse: e.target.value })} style={{ width: 130 }} /></Field>
        <Field label="Kiểu bán"><input value={r.saleType} onChange={(e) => set({ saleType: e.target.value })} style={{ width: 110 }} /></Field>
        <Field label="Ảnh sản phẩm"><input value={r.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} style={{ width: 160 }} /></Field>
        <Field label="Ghi chú dòng"><input value={r.note} onChange={(e) => set({ note: e.target.value })} style={{ width: 150 }} /></Field>
        <Field label="Thành tiền"><b>{(Number(r.qty || 0) * Number(r.unitPrice || 0)).toLocaleString('vi-VN')}</b></Field>
      </div>
    </div>
  );
}
