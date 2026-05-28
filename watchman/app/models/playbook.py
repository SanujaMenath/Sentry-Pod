from pydantic import BaseModel
from typing import Optional, List

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