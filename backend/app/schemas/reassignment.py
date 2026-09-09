"""Schemas for the Reassign Owners screen — a Geo Head or Delivery Excellence
user changes a Project's Project Manager, an Account's Account Manager, or a
Geo's Geo Head, any time, independent of the project/amendment workflow.

Rows mirror the enriched shape of DeAllocationRow (schemas/de_approval.py):
the entity plus its current owner's name, so the grid needs no second fetch.
"""

from uuid import UUID

from pydantic import BaseModel


class ReassignProjectRow(BaseModel):
    project_id: UUID
    project_code: str
    project_name: str
    account_name: str | None = None
    geo_name: str | None = None
    region_name: str | None = None
    project_manager_id: UUID | None = None
    project_manager_name: str | None = None


class ReassignAccountRow(BaseModel):
    account_id: UUID
    account_name: str
    geo_name: str | None = None
    account_manager_id: UUID | None = None
    account_manager_name: str | None = None


class ReassignGeoRow(BaseModel):
    geo_id: UUID
    geo_code: str
    geo_name: str
    geo_head_id: UUID | None = None
    geo_head_name: str | None = None


class ReassignProjectManagerBody(BaseModel):
    project_manager_id: UUID


class ReassignAccountManagerBody(BaseModel):
    user_id: UUID


class ReassignGeoHeadBody(BaseModel):
    user_id: UUID
