import sys
import pprint
print('executable:', sys.executable)
print('sys.path:')
pprint.pp(sys.path)
try:
    import pdfplumber
    print('pdfplumber ok', pdfplumber.__file__)
except Exception as e:
    print('pdfplumber import failed:', type(e).__name__, e)
