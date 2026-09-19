'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { Field } from '../../components/Field';
import { Guard } from '../../components/Shell';

export default function HrPage() {
  const [form, setForm] = useState({ name: '', phone: '', position: '', dailyWage: '', startDate: new Date().toISOString().slice(0, 10) });
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  const emps = useQuery({ queryKey: ['emps'], queryFn: () => api('/hr/employees') });
  const payroll = useQuery({ queryKey: ['payroll', month], queryFn: () => api(`/hr/payroll?month=${month}`) });
  const create = useMutation({
    mutationFn: () => api('/hr/employees', { method: 'POST', body: JSON.stringify({ ...form, dailyWage: Number(form.dailyWage) }) }),
    onSuccess: () => { setForm({ name: '', phone: '', position: '', dailyWage: '', startDate: new Date().toISOString().slice(0, 10) }); qc.invalidateQueries({ queryKey: ['emps'] }); },
    onError: (e: any) => setMsg(e.message),
  });

  return (
    <Guard>
      <h1>Nhân sự</h1>
      <div className="card">
        <div className="row">
          <Field label="Tên nhân viên mới"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="SĐT"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Chức vụ"><input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
          <Field label="Ngày vào làm"><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="Lương ngày"><input type="number" value={form.dailyWage} onChange={(e) => setForm({ ...form, dailyWage: e.target.value })} /></Field>
          <button onClick={() => create.mutate()} disabled={!form.name} style={{ alignSelf: 'end' }}>Thêm</button>
        </div>
        {msg && <div className="err">{msg}</div>}
        <table><thead><tr><th>Tên</th><th>SĐT</th><th>Chức vụ</th><th>Trạng thái</th><th>Chấm công / Ứng</th></tr></thead>
          <tbody>{(emps.data || []).map((e: any) => (
            <EmpRow key={e.id} e={e} />
          ))}</tbody></table>
      </div>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}><h3>Bảng lương tháng {month}</h3><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
        <table><thead><tr><th>NV</th><th>Công</th><th>Tăng ca</th><th>Thưởng</th><th>Ứng</th><th>Thực nhận (ước)</th></tr></thead>
          <tbody>{(payroll.data?.rows || []).map((r: any) => (
            <tr key={r.employee}><td>{r.employee}</td><td>{r.totalShifts}</td><td>{r.overtimeH}</td><td>{Number(r.bonus).toLocaleString('vi-VN')}</td><td>{Number(r.totalAdv).toLocaleString('vi-VN')}</td><td>{Number(r.estimate).toLocaleString('vi-VN')}</td></tr>
          ))}</tbody></table>
      </div>
    </Guard>
  );
}

function EmpRow({ e }: { e: any }) {
  const [att, setAtt] = useState({ date: new Date().toISOString().slice(0, 10), shifts: '1', overtimeH: '0', bonus: '0' });
  const [adv, setAdv] = useState({ amount: '', note: '' });
  const [msg, setMsg] = useState('');
  return (
    <tr>
      <td>{e.name}</td><td>{e.phone || ''}</td><td>{e.position || ''}</td><td>{e.status}</td>
      <td>
        <div className="row">
          <Field label="Ngày chấm"><input type="date" value={att.date} onChange={(ev) => setAtt({ ...att, date: ev.target.value })} style={{ width: 140 }} /></Field>
          <Field label="Công"><input value={att.shifts} onChange={(ev) => setAtt({ ...att, shifts: ev.target.value })} style={{ width: 60 }} /></Field>
          <Field label="Tăng ca (giờ)"><input value={att.overtimeH} onChange={(ev) => setAtt({ ...att, overtimeH: ev.target.value })} style={{ width: 70 }} /></Field>
          <Field label="Thưởng"><input value={att.bonus} onChange={(ev) => setAtt({ ...att, bonus: ev.target.value })} style={{ width: 90 }} /></Field>
          <button className="ghost" style={{ alignSelf: 'end' }} onClick={() => api('/hr/attendance', { method: 'POST', body: JSON.stringify({ employeeId: e.id, ...att, shifts: Number(att.shifts), overtimeH: Number(att.overtimeH), bonus: Number(att.bonus) }) }).then(() => setMsg('Chấm OK')).catch((er: any) => setMsg(er.message))}>Chấm công</button>
          <Field label="Tiền ứng (đ)"><input value={adv.amount} onChange={(ev) => setAdv({ ...adv, amount: ev.target.value })} style={{ width: 100 }} /></Field>
          <Field label="Lý do ứng"><input value={adv.note} onChange={(ev) => setAdv({ ...adv, note: ev.target.value })} style={{ width: 120 }} /></Field>
          <button className="ghost" style={{ alignSelf: 'end' }} onClick={() => api('/hr/advances', { method: 'POST', body: JSON.stringify({ employeeId: e.id, amount: Number(adv.amount), note: adv.note }) }).then(() => { setAdv({ amount: '', note: '' }); setMsg('Ứng OK'); }).catch((er: any) => setMsg(er.message))}>Ứng lương</button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      </td>
    </tr>
  );
}
