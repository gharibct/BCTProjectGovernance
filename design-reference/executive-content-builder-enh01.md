# Enhance Executive Content Builder — Clipboard Paste

Enhance the existing **ExecutiveContentBuilder**. The basic Rich Text, Image and Table functionality is already working.

Do not redesign or rewrite the existing component. Preserve the current UI and functionality and add the following clipboard features.

## 1. Image Block — Paste Image

Enhance the existing Image block to support direct clipboard paste.

The user should be able to:

* take a screenshot or copy an image;
* select/focus an Image block;
* press `Ctrl+V`;
* immediately see the pasted image as a preview;
* save it using the existing image upload/storage mechanism.

The Image block should support both:

* Browse/Upload
* Paste from clipboard

If the clipboard does not contain an image, do nothing and do not show an unnecessary error.

## 2. Table Block — Paste from Excel

Enhance the existing Table block so users can copy a cell range from Excel and paste it directly using `Ctrl+V`.

Example Excel data:

```text
Metric          Actual    Target    Status
Revenue         95        100       Amber
Margin          22%       20%       Green
Utilization     87%       85%       Green
```

When pasted, automatically create/update the table with the same rows and columns.

Use clipboard HTML when useful, with tab/newline-delimited clipboard text as a fallback.

The pasted table must remain fully editable using the existing Table block functionality.

## 3. Merged Excel Cells

Do not implement merged cells in the application table.

If copied Excel content contains merged cells:

* convert it into a normal rectangular table;
* retain the merged-cell value in the appropriate first/top-left cell;
* leave the corresponding additional cells empty;
* do not implement `rowspan` or `colspan`.

If useful, show a small non-blocking message:

> Merged cells were converted to standard table cells.

## 4. Keep the Implementation Simple

Do not add:

* Excel file import;
* formulas;
* macros;
* Excel formatting replication;
* conditional formatting;
* merged-cell editing;
* a spreadsheet library;
* a heavy grid library.

This enhancement is only for convenient clipboard input.

The expected user experience is:

```text
Screenshot/Image
Copy → Image Block → Ctrl+V → Preview
```

and:

```text
Excel Cell Range
Copy → Table Block → Ctrl+V → Editable Table
```

Preserve all existing functionality and styling.

After implementation, test:

* pasting a screenshot;
* pasting a copied image;
* pasting a normal Excel range;
* pasting Excel data containing empty cells;
* pasting Excel data containing merged cells;
* pasting multiple rows and columns;
* normal table editing after paste;
* existing image upload functionality.

Fix any TypeScript or build errors introduced by the enhancement.
