## AI-Assisted Project Governance Solution

The objective is to use a **local LLM** to assist users during **Project Creation** and **Project Reporting** by extracting structured information from project-related documents. The AI acts as an assistant that prepares data for the user to review—it never updates the project directly.

---

# 1. Supported Inputs

The AI solution accepts one or more project documents, such as:

* Project Charter
* Statement of Work
* Contract
* Proposal
* Schedule (Excel)
* Commercial documents
* Resource plans
* Weekly status reports
* Steering committee presentations
* Risk registers
* Issue registers
* Meeting minutes
* Meeting transcripts
* Any DOCX, PDF, XLSX or plain text document

Document parsing (PDF, Word, Excel, etc.) is handled outside the LLM. The LLM receives extracted text.

---

# 2. AI Processing

The application sends the extracted text to a **local vLLM server** through its OpenAI-compatible API.

The LLM performs structured extraction using a **dynamic extraction schema** supplied by the application.

Examples include:

* Project Creation
* Project Reporting
* General Extraction

The extraction schema determines what information the AI should extract.

---

# 3. AI Output

The AI returns structured JSON.

Each extracted field contains:

* Extracted value
* Confidence
* Source document
* Source location (page, sheet, paragraph, etc.)
* Evidence (exact supporting text)

Example:

```json
{
  "project_name": {
    "value": "Digital Field Optimization",
    "confidence": 0.96,
    "source": "Project_Charter.pdf",
    "page": 3,
    "evidence": "Project Name: Digital Field Optimization"
  }
}
```

This JSON is an intermediate representation and is **not** written directly to the Project Governance database.

---

# 4. AI Review

The application stores the extracted JSON temporarily.

The Project Manager opens the normal Project Governance screen (Project Charter or Project Reporting).

The user clicks:

**Apply AI Suggestions**

The application copies AI-derived values from the JSON into the corresponding controls.

The database is **not** updated at this stage.

---

# 5. AI-Assisted Forms

The review happens inside the existing application screens.

No separate review application or mapping screen is created.

The AI simply pre-populates the existing controls.

Examples:

* Project Name
* Project Manager
* Start Date
* Budget
* Milestones
* Risks
* Issues
* KPIs

---

# 6. Confidence Indicators

Each AI-populated control displays a confidence indicator as a box before the control

Suggested visual treatment:

* 🟩 Green – High Confidence
* 🟨 Amber – Medium Confidence
* 🟥 Red – Low Confidence / Review Required

The confidence indicator applies only to AI-populated values.

---

# 7. AI Information Box

On click of the AI Box, AI information pop up is shown which contains the following information.

* Confidence
* Source document
* Source location
* Evidence
* Suggested action

Example:

```
🤖 AI Suggestion

Confidence
High (96%)

Source
Project_Charter.pdf
Page 3

Evidence
"The project shall be called Digital Field Optimization."

[Apply]
[Ignore]
```


---

# 8. User Review

The Project Manager can:

* Accept the AI value
* Modify the value
* Ignore the suggestion

The application behaves exactly like a normal data-entry form.

---

# 9. Manual Changes

If the user edits an AI-populated value:

* the AI indicator is removed;
* the value becomes a normal manually entered value.

The user remains the final authority. Similarly, if the user clicks Save or Edit or Create button, AI provided values are treated as manual value, hence the AI indicators are removed.

---

# 10. Grid Review

For grids such as:

* Risks
* Issues
* Dependencies
* Resources
* Milestones

the AI confidence applies to the **entire row** rather than individual cells.

Example:

| AI | Risk                   | Probability | Impact | Owner |
| -- | ---------------------- | ----------- | ------ | ----- |
| 🟩 | Procurement Delay      | High        | High   | John  |
| 🟨 | Vendor Availability    | Medium      | High   | Ravi  |
| 🟥 | Cybersecurity Approval | Unknown     | High   | —     |

---

# 11. Design Principles

The solution is guided by the following principles:

* AI assists the user; it does not replace user decisions.
* AI never writes directly to business tables.
* The existing Project Governance screens remain the primary workspace.
* AI suggestions are embedded within normal business controls.
* Every suggestion includes supporting evidence.
* Users can accept, modify, or ignore AI-generated values.
* The UI remains scalable for large forms and complex grids.
* The same AI review pattern is reused across Project Creation, Project Reporting, and future modules.
