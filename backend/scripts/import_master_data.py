"""Import a filled-in master-data workbook.

Run from backend/: python -m scripts.import_master_data <file.xlsx> [--apply] [--sheets=a,b]
"""

from app.master_data.import_template import main

if __name__ == "__main__":
    main()
