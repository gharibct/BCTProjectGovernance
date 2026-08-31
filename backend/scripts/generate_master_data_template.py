"""Generate the master-data Excel template.

Run from backend/: python -m scripts.generate_master_data_template [--out PATH]
"""

from app.master_data.generate_template import main

if __name__ == "__main__":
    main()
