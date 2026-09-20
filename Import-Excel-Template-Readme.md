# Import Excel Templates

The **Export Template** button on every import grid downloads a predefined, hand-formatted Excel template when one exists on the server. If there is none (or it is out of date), it downloads an auto-generated headers-only template instead.

## How to add or update a template

1. On the screen, click **Export Template** (this gives you the default template).
2. Open it in Excel and format it (see [Formatting rules](#formatting-rules)).
3. Save it as `<slug>-template.xlsx` (see the [grid list](#grids-and-file-names)) into **`backend/import_templates/`**.

Nothing needs rebuilding or restarting — the file is read on every download. The folder can be moved with the `import_template_dir` setting (`backend/app/core/config.py`). Commit the folder to git if the templates should deploy with the code; otherwise copy the files onto the server by hand.

## File naming

`<slug>-template.xlsx`, where **slug** = the grid's plural item name (`itemLabelPlural` in the code), lower-cased, with every run of non-alphanumeric characters replaced by `-`.

Example: "Delivery Status - Projects" → `delivery-status-projects-template.xlsx`.

## Grids and file names

| Grid (Export Template on…)          | Screen / location                                   | File name                                  |
|-------------------------------------|-----------------------------------------------------|--------------------------------------------|
| Bulk Projects                       | Admin → Bulk Projects                               | `projects-template.xlsx`                   |
| Bulk DSR - Projects                 | Admin → Bulk DSR - Projects                         | `delivery-status-projects-template.xlsx`   |
| Bulk DSR - Accounts                 | Admin → Bulk DSR - Accounts                         | `delivery-status-accounts-template.xlsx`   |
| Accounts                            | Admin → Accounts                                    | `accounts-template.xlsx`                   |
| Geos                                | Admin → Geos                                        | `geos-template.xlsx`                       |
| Risks                               | RAIDO (Create / Maintain Project and Reporting)     | `risks-template.xlsx`                      |
| Issues                              | RAIDO (Create / Maintain Project and Reporting)     | `issues-template.xlsx`                     |
| Assumptions                         | RAIDO (Create / Maintain Project and Reporting)     | `assumptions-template.xlsx`                |
| Dependencies                        | RAIDO (Create / Maintain Project and Reporting)     | `dependencies-template.xlsx`               |
| Opportunities                       | RAIDO (Create / Maintain Project and Reporting)     | `opportunities-template.xlsx`              |
| Commitments                         | Contractual Compliance → Commitments                | `commitments-template.xlsx`                |
| Payment Milestones                  | Contractual Compliance → Milestones                 | `payment-milestones-template.xlsx`         |
| Findings                            | DE Assessment → Findings register                   | `findings-template.xlsx`                   |
| Resources                           | Project Charter → Resource Allocation               | `resources-template.xlsx`                  |

Notes:
- You only need to provide the templates you want formatted. Any grid without a file keeps the auto-generated template.
- Grids that appear on more than one screen (the RAIDO registers) share one file, since they use the same columns.

## Formatting rules

- **Sheet 1, row 1 must keep the header text exactly as exported.** The importer matches columns by that header text.
- Fine to change: styling, column widths, colours, data-validation dropdowns, freeze panes, column order, extra columns (notes / helper columns) and extra sheets.
- Not fine: renaming or deleting a header, or adding a title row above the headers.

## Out-of-date templates

Before serving a custom template, the browser checks that its header row still contains **every current column label** of the grid. If a label is missing or renamed (for example after a field was added or renamed in the app), it downloads the auto-generated template instead and shows the toast:

> Custom template is out of date — downloaded the default template instead.

When you see that, re-export the default template, re-apply your formatting, and replace the file.

## Maintaining this document

When a new import grid is added (a screen that uses `RegisterImportToolbar`), add a row to [Grids and file names](#grids-and-file-names) with its `itemLabelPlural` slug. To list the current grids:

```
grep -rn "itemLabelPlural=" frontend/src
```
