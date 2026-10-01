Use this prompt with Claude:

> Create a **new alternative page** for the existing **Report Delivery Status** screen.  
> **Do not modify, replace, or delete the existing page.** Keep the current page fully functional so we can switch between the existing and new designs later.
>
> ### New Page – Report Delivery Status
>
> Use the **same application layout, project context, styling, APIs, data and permissions** as the existing Report Delivery Status page.
>
> **1. Header**
> - Show Project Code + **Report Delivery Status**
> - Show Project Name below.
> - Default period: **Last 6 Months**
> - Provide period selector: Last 3 Months / Last 6 Months / Last 12 Months.
>
> **2. KPI Summary**
>
> Display KPI cards:
> - Expected Reports
> - Submitted
> - Not Submitted
> - Approved
> - Rejected
> - Late Submissions
>
> All KPI values must be calculated for the selected period.
>
> **3. Submission Compliance**
>
> Show a donut chart with:
> - Submission %
> - Submitted count
> - Not Submitted count
>
> Keep this section compact and visually clean.
>
> **4. Reporting Calendar**
>
> For the default **Last 6 Months**, display months as a **3 columns × 2 rows calendar/card layout**.
>
> Each month should look like a small calendar containing the **4 or 5 weekly reporting dates as clearly visible clickable date boxes**.
>
> Example:
>
> ```text
> MAY 2026          JUN 2026          JUL 2026
> [01] [08] [15]    [05] [12] [19]    [03] [10] [17]
> [22] [29]         [26]              [24] [31]
>
> AUG 2026          SEP 2026          OCT 2026
> [07] [14] [21]    [04] [11] [18]    [02] [09] [16]
> [28]              [25]              [23] [30]
> ```
>
> Use color coding for date boxes:
> - **Approved – Green**
> - **Submitted – Blue**
> - **Rejected – Red**
> - **Due / Not Submitted – Amber**
> - **Not Due – White/light outline**
> - **Late submission – small Orange indicator** in addition to the actual report status.
>
> Show a clear legend above/below the calendar.
>
> **5. Date Interaction**
>
> On clicking a reporting date:
> - If a report exists, launch/open that report.
> - If the report is due but not submitted, launch the reporting form for that period.
> - For future/not-due periods, follow the existing application rules.
>
> On hover, show reporting date, status, submitted date and whether it was on time/late.
>
> **6. KPI Interaction**
>
> Make KPI cards clickable where practical. Clicking **Rejected**, **Late**, **Not Submitted**, etc. should highlight/filter the corresponding reporting dates in the calendar.
>
> **Important:** Reuse existing backend APIs and existing report functionality wherever possible. This exercise is primarily a **new UI/UX view**. Do not break or change the existing Report Delivery Status page, routes, APIs or functionality. Create a separate route/page so we can compare both versions and later decide which one to retain.