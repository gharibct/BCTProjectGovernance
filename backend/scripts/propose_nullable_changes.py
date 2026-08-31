"""Propose nullable-column changes from a filled-in workbook's hidden columns.

Run from backend/: python -m scripts.propose_nullable_changes <file.xlsx>
"""

from app.master_data.propose_nullable_changes import main

if __name__ == "__main__":
    main()
