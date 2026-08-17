import pdfplumber
import sys
sys.stdout.reconfigure(encoding='utf-8')

f = r'c:\Users\Admin\Downloads\Sensovibe_Emd_Inventory - Sensovibe_General_inventory_1 .pdf'
with pdfplumber.open(f) as pdf:
    page = pdf.pages[0]
    tables = page.extract_tables()
    print('tables', len(tables))
    for ti, table in enumerate(tables, start=1):
        print('table', ti, 'rows', len(table), 'cols by row lengths sample', [len(r) for r in table[:10]])
        for ri, row in enumerate(table[:15], start=1):
            print('ROW', ri, '[', len(row), ']:')
            for ci, cell in enumerate(row):
                if cell and cell.strip():
                    print(f'  col{ci}: {repr(cell)}')
            print('--')
