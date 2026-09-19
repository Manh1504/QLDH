export function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label className="field" style={style}>
      <span>{label}</span>
      {children}
    </label>
  );
}
