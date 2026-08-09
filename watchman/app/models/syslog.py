from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SyslogAlert(BaseModel):
    device: str
    severity: int
    severity_name: str
    facility: str
    mnemonic: str
    message: str
    timestamp: datetime
    source_ip: str

class SyslogAlertCreate(BaseModel):
    source_ip: str
    facility: str
    severity: int
    severity_name: str
    mnemonic: str
    message: str
    timestamp: Optional[datetime] = None
    msg_hostname: Optional[str] = None
