'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '../../lib/api-client';
import { Field } from '../../components/Field';

export default function LoginPage() {
  const [u, setU] = useState('owner');
  const [p, setP] = useState('owner123');
  const [err, setErr] = useState('');
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await login(u, p);
      router.push('/dashboard');
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="login-wrap">
      <form className="card login-box" onSubmit={submit}>
        <div className="login-brand">✂ Azalas</div>
        <p className="muted">Quản lý xưởng may — bán hàng · kho · công nợ</p>
        <div style={{ display: 'grid', gap: 8 }}>
          <Field label="Tên đăng nhập"><input value={u} onChange={(e) => setU(e.target.value)} style={{ width: '100%' }} /></Field>
          <Field label="Mật khẩu"><input value={p} onChange={(e) => setP(e.target.value)} type="password" style={{ width: '100%' }} /></Field>
          {err && <div className="err">{err}</div>}
          <button type="submit">Đăng nhập</button>
          <div className="muted">Mặc định: owner / owner123</div>
        </div>
      </form>
    </div>
  );
}
