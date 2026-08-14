# Claude Code Prompt — Executive Update Content Builder

Develop a reusable **ExecutiveContentBuilder** for the existing Project Governance application.

This will be used for **CXO Executive Update**, where users need flexibility similar to preparing content in PowerPoint.

Do not redesign the application. Follow the existing Next.js/React, TypeScript, Tailwind and UI conventions.

## Screen Structure

An Executive Update contains business sections.

Default sections:

* Delivery
* People
* Financials
* Operations

Users must be able to:

* add a new section;
* rename a section;
* delete a section;
* move a section up/down.

Each business section can contain multiple content blocks.

Support only these three content block types:

### 1. Rich Text

Use a rich-text editor supporting:

* headings;
* paragraphs;
* bold;
* italic;
* bullets;
* numbered lists;
* links.

Use **Tiptap** if the project does not already contain a suitable rich-text editor.

### 2. Image

Allow the user to:

* upload an image;
* preview it;
* replace it;
* delete it;
* optionally enter a caption.

Use the application's existing file-upload mechanism where available.

### 3. Table

Provide a simple editable table supporting:

* editable cells;
* add row;
* delete row;
* add column;
* delete column.

Do not use a heavy data-grid library.

The table can also be used for KPI-style information.

## User Experience

A section should appear approximately as:

```text
Delivery                                      ⋮

[ Rich Text Content ]

[ Image / Chart ]

[ Table ]

+ Add Content
```

Clicking **+ Add Content** should provide:

```text
Rich Text | Image | Table
```

The section menu `⋮` should provide:

```text
Rename
Move Up
Move Down
Delete
```

Content blocks should also have simple actions to:

```text
Move Up
Move Down
Delete
```

Do NOT implement drag-and-drop.

At the bottom provide:

```text
+ Add Section
```

Keep the UI clean, bright, compact and suitable for an enterprise application.

## Data Model

Do not store the entire Executive Update as one HTML document.

Store sections and content blocks as structured data.

Example:

```json
{
  "sections": [
    {
      "id": "section-1",
      "title": "Delivery",
      "sequence": 1,
      "blocks": [
        {
          "id": "block-1",
          "type": "rich_text",
          "sequence": 1,
          "content": "<p>Overall delivery remains stable.</p>"
        },
        {
          "id": "block-2",
          "type": "image",
          "sequence": 2,
          "imageUrl": "",
          "caption": ""
        },
        {
          "id": "block-3",
          "type": "table",
          "sequence": 3,
          "columns": ["Metric", "Value", "Status"],
          "rows": [
            ["Projects On Track", "18", "Green"],
            ["Projects At Risk", "4", "Amber"]
          ]
        }
      ]
    }
  ]
}
```

Use stable IDs for sections and blocks.

## Reusable Component

Create:

```tsx
<ExecutiveContentBuilder
  value={executiveUpdate}
  onChange={setExecutiveUpdate}
/>
```

The parent screen should be able to provide existing content and receive the updated structured content.

## Important

Keep the implementation simple.

Do not build a PowerPoint clone.

Do not implement:

* free-positioned objects;
* resizing;
* slide layouts;
* drag-and-drop;
* charts;
* dashboards;
* AI functionality;
* document generation.

The requirement is simply:

**Business Sections → Rich Text / Image / Table content blocks.**

Users should have enough flexibility to prepare an Executive Update similar to the content they currently prepare in PPT, while the application retains structured and manageable data.

Implement the reusable component and integrate it into one sample **Executive Update** screen.

After implementation, check TypeScript/build errors and test adding, editing, moving and deleting sections and content blocks.
