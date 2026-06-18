from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class PlaybookRequest(BaseModel):
    playbook_name: str
    description: Optional[str] = None

class PlaybookResponse(BaseModel):
    status: str
    playbook_name: str
    message: str
    output: Optional[str] = None

class PlaybookCatalogItem(BaseModel):
    filename: str
    name: str
    description: str
    tags: List[str]
    target_devices: List[str]
    example_intents: List[str]
    destructive: bool = False
    severity: str = "medium"

class PlaybookSuggestion(BaseModel):
    filename: str
    name: str
    description: str
    tags: List[str]
    match_score: float
    reason: str
    destructive: bool
    severity: str
    target_devices: List[str]
    playbook_preview: str = ""

class PlaybookBlueprintResponse(BaseModel):
    id: str = Field(..., description="Unique configuration asset identifier")
    name: str = Field(..., description="Filename of the playbook manifest")
    engine_type: str = Field("Ansible", description="Automation framework used")
    subnet_scope: str = Field(..., description="Target network inventory group")
    pipeline_status: str = Field("Draft", description="Workspace validation state")
    file_path: str = Field(..., description="Local server file path storage destination")
    last_run: Optional[datetime] = None

    class Config:
        from_attributes = True

class AddPlaybookRequest(BaseModel):
    name: str
    description: str = ""
    engine_type: str = "Ansible"
    subnet_scope: str = ""
    pipeline_status: str = "Draft"
    tags: List[str] = []
    target_devices: List[str] = []
    example_intents: List[str] = []
    destructive: bool = False
    severity: str = "medium"

class UpdatePlaybookRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    engine_type: Optional[str] = None
    subnet_scope: Optional[str] = None
    pipeline_status: Optional[str] = None
    tags: Optional[List[str]] = None
    target_devices: Optional[List[str]] = None
    example_intents: Optional[List[str]] = None
    destructive: Optional[bool] = None
    severity: Optional[str] = None
    filename: Optional[str] = None

class UpdatePlaybookStatusRequest(BaseModel):
    pipeline_status: str