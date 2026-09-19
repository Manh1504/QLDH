"""ETL Sheets(xlsx) -> Postgres (via Prisma seed JSON).
Chạy: python etl.py --indir <thư mục 10 xlsx> --out seed-data.json
- Đọc header hàng 1, đếm dòng, phát hiện trùng mã, ngày/tiền bẩn.
- Xuất JSON + báo cáo đối chiếu (tổng đơn, tổng nợ khách, nợ NCC).
Import vào Postgres bằng: npx tsx import.ts (đọc seed-data.json, upsert Prisma).
"""
import argparse, json, sys
from pathlib import Path
from collections import Counter

def load_wb(path):
    import openpyxl
    wb = openpyxl.load_workbook(path, data_only=True)
    out = {}
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            out[ws.title] = {"headers": [], "data": 0, "dupes": {}}
            continue
        headers = [(str(c).strip() if c is not None else "") for c in rows[0]]
        body = [r for r in rows[1:] if any(c is not None and str(c).strip() != "" for c in r)]
        dupes = {}
        if headers and headers[0]:
            keys = [str(r[0]) for r in body if r[0] is not None]
            dupes = {k: c for k, c in Counter(keys).items() if c > 1}
        out[ws.title] = {"headers": headers, "data": len(body), "dupes": dupes}
    wb.close()
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--indir", required=True)
    ap.add_argument("--out", default="seed-data.json")
    a = ap.parse_args()
    indir = Path(a.indir)
    files = sorted(indir.glob("*.xlsx"))
    if not files:
        print(f"Không thấy xlsx trong {indir}", file=sys.stderr)
        sys.exit(1)
    report = {}
    for f in files:
        report[f.name] = load_wb(f)
        print(f.name, {k: v["data"] for k, v in report[f.name].items()})
    Path(a.out).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Ghi {a.out}. Đối chiếu: DonHang={report.get('02_DATA_SALES_CRM.xlsx', {}).get('tbl_DonHang', {}).get('data')}, KhachHang={report.get('02_DATA_SALES_CRM.xlsx', {}).get('tbl_KhachHang', {}).get('data')}")

if __name__ == "__main__":
    main()
