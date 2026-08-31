Action Main Table
| Column         | Type          | Mandatory | Description                                               |
| -------------- | ------------- | --------: | --------------------------------------------------------- |
| `action_id`    | UUID / BIGINT |       Yes | Primary key                                               |
| `level`        | VARCHAR(20)   |       Yes | `GEO`, `ACCOUNT`, `PROJECT`                               |
| `level_value`  | VARCHAR(100)  |       Yes | Geo Code / Account Code / Project Code                    |
| `title`        | VARCHAR(250)  |       Yes | Short action title                                        |
| `description`  | TEXT          |        No | Detailed action description                               |
| `action_by_id`     | VARCHAR(100)  |       Yes | Person responsible for the action                         |
| `priority`     | VARCHAR(20)   |       Yes | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`                       |
| `status`       | VARCHAR(20)   |       Yes | `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CLOSED`, `CANCELLED` |
| `due_date`     | DATE          |       Yes | Target completion date                                    |
| `raised_by`    | VARCHAR(100)  |       Yes | User who created the action                               |
| `raised_at`    | TIMESTAMP     |       Yes | Creation timestamp                                        |
| `completed_at` | TIMESTAMP     |        No | When marked completed                                     |
| `closed_at`    | TIMESTAMP     |        No | When formally closed                                      |
| `closed_by`    | VARCHAR(100)  |        No | User who closed it                                        |
| `created_at`   | TIMESTAMP     |       Yes | Audit field                                               |
| `updated_at`   | TIMESTAMP     |       Yes | Audit field                                               |


ACTION HISTORY:
| Column       | Type          | Mandatory | Description                                                                    |
| ------------ | ------------- | --------: | ------------------------------------------------------------------------------ |
| `history_id` | UUID / BIGINT |       Yes | Primary key                                                                    |
| `action_id`  | FK            |       Yes | References Action                                                              |
| `event_type` | VARCHAR(30)   |       Yes | `CREATED`, `COMMENT`, `STATUS_CHANGE`, `OWNER_CHANGE`, `DUE_DATE_CHANGE`, etc. |
| `comment`    | TEXT          |        No | Progress update/comment                                                        |
| `old_value`  | TEXT          |        No | Previous value where applicable                                                |
| `new_value`  | TEXT          |        No | New value                                                                      |
| `created_by` | VARCHAR(100)  |       Yes | User making the change                                                         |
| `created_at` | TIMESTAMP     |       Yes | Timestamp                                                                      |
