from pydantic import BaseModel
from typing import Optional, List


class GlobalCreds(BaseModel):
    ansible_user: str = "admin"
    ansible_password: str = "cisco"
    ansible_become_password: str = ""
    snmp_community: str = "public"


class DeviceEntry(BaseModel):
    hostname: str
    ip: str
    vlan_id: Optional[int] = None
    vlan_name: Optional[str] = None
    default_gateway: Optional[str] = None


class SetupPreviewRequest(BaseModel):
    global_creds: GlobalCreds
    edge_routers: List[DeviceEntry] = []
    core_switches: List[DeviceEntry] = []
    distribution_switches: List[DeviceEntry] = []
    hsrp_pairs: List[str] = []
    access_switches: List[DeviceEntry] = []


class SetupApplyRequest(SetupPreviewRequest):
    flush_mongo: bool = True
    flush_disk: bool = True


class SetupDiff(BaseModel):
    added: List[str] = []
    removed: List[str] = []
    changed: List[str] = []
    unchanged: int = 0


class SetupPreviewResponse(BaseModel):
    status: str
    summary: dict
    generated_ini: str
    diff: SetupDiff
    warnings: List[str]
    flush_plan: dict
    report_path: str
    report_markdown: str


class SetupApplyResponse(BaseModel):
    status: str
    message: str
    report_path: str
    flushed_collections: List[str]
    flushed_files: List[str]


class SetupStatusResponse(BaseModel):
    setup_complete: bool
    is_demo: bool
    device_count: int
    message: str
