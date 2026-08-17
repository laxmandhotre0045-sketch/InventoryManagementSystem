import pdfplumber

files = [
    r'c:\Users\Admin\Downloads\Sensovibe_Emd_Inventory - Sensovibe_General_inventory_1 .pdf',
    r'c:\Users\Admin\Downloads\Sensovibe_Emd_Inventory - Sensovibe_General_inventory_2.pdf',
]

for f in files:
    print('FILE', f)
    with pdfplumber.open(f) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            print('PAGE', i)
            tables = page.extract_tables()
            for j, table in enumerate(tables, start=1):
                print(' TABLE', j, 'rows', len(table))
                for row in table:
                    print(row)
                print('---')
