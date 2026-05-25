from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

class TrafficDataPoint(BaseModel):
    time: str
    traffic: int


class NetworkDevice(BaseModel):
    id: str
    name: str
    ip: str
    type: str = "switch"
    model: str = "Pending discovery"
    version: str = "Unknown"
    uptime: str = "N/A"
    cpu: int = Field(default=0, ge=0, le=100)
    memory: int = Field(default=0, ge=0, le=100)
    online: bool = False


class NetworkDeviceCreate(BaseModel):
    name: str
    ip: str
    type: str = "switch"
    model: Optional[str] = None
    version: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


class DeviceConfigurationRequest(BaseModel):
    ssh_port: int = Field(default=22, alias="sshPort", ge=1, le=65535)
    username: str = "admin"
    auth_method: Literal["password", "key"] = Field(default="password", alias="authMethod")
    password: Optional[str] = None
    enable_password: Optional[str] = Field(default=None, alias="enablePassword")
    interface_name: str = Field(default="GigabitEthernet1/0/1", alias="interfaceName")
    vlan_id: str = Field(default="10", alias="vlanId")
    management_ip: Optional[str] = Field(default=None, alias="managementIp")
    subnet_mask: str = Field(default="255.255.255.0", alias="subnetMask")
    gateway: Optional[str] = None
    snmp_community: Optional[str] = Field(default=None, alias="snmpCommunity")
    syslog_server: Optional[str] = Field(default=None, alias="syslogServer")
    ntp_server: Optional[str] = Field(default=None, alias="ntpServer")
    notes: Optional[str] = None

    class Config:
        allow_population_by_field_name = True


class DeviceConfiguration(BaseModel):
    device_id: str
    device_name: str
    ssh_port: int
    username: str
    auth_method: Literal["password", "key"]
    interface_name: str
    vlan_id: str
    management_ip: Optional[str] = None
    subnet_mask: str
    gateway: Optional[str] = None
    snmp_community: Optional[str] = None
    syslog_server: Optional[str] = None
    ntp_server: Optional[str] = None
    notes: Optional[str] = None
    saved_at: datetime


class DeviceConfigurationResponse(BaseModel):
    status: str
    message: str
    configuration: DeviceConfiguration


class NetworkTerminalCommand(BaseModel):
    command: str


class NetworkTerminalResponse(BaseModel):
    device_id: str
    prompt: str
    command: str
    output: str
