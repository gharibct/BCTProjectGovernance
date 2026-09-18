"""Schema for the Project Profile "Project Owned" info tooltip — served
read-only from app/data/project_owned_reference.yaml (see
app.services.project_owned_reference).
"""

from pydantic import BaseModel


class ProjectOwnedReferenceEntry(BaseModel):
    description: str


# Keyed by the ProjectOwned enum value ("Fully Owned", "Co-Owned", "Customer Driven").
ProjectOwnedReference = dict[str, ProjectOwnedReferenceEntry]
