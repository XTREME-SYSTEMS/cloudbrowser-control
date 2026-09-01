"""
Cloud Browser SDK Models
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any


@dataclass
class SessionConfig:
    viewport: Dict = field(default_factory=lambda: {"width": 1920, "height": 1080})
    user_agent: Optional[str] = None
    locale: str = "en-US"
    timezone: str = "America/New_York"
    proxy_id: Optional[str] = None
    headers: Dict = field(default_factory=dict)
    blocked_resources: List[str] = field(default_factory=list)
    record_video: bool = False
    enable_cdp: bool = False
    fingerprint: Optional[Dict] = None
    tls_fingerprint: Optional[Dict] = None


@dataclass
class JobConfig:
    name: str
    start_url: str
    priority: int = 5
    max_retries: int = 3
    backoff_seconds: int = 30
    shadow_mode: bool = False
    tags: List[str] = field(default_factory=list)
    session_config: Optional[SessionConfig] = None


@dataclass
class StepConfig:
    job_id: str
    action_type: str
    order: int = 0
    selector: Optional[str] = None
    value: Optional[str] = None
    options: Dict = field(default_factory=dict)
    output_schema: Optional[Dict] = None


@dataclass
class ProxyConfig:
    name: str
    server: str
    protocol: str = "http"
    ip_type: str = "datacenter"
    provider: str = "custom"
    country: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    asn: Optional[str] = None
    zip_code: Optional[str] = None
    rotation_group: Optional[str] = None


@dataclass
class Session:
    id: str
    status: str
    target_url: str
    session_id: Optional[str] = None
    viewport: Optional[Dict] = None
    user_agent: Optional[str] = None
    proxy_id: Optional[str] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    current_url: Optional[str] = None
    video_url: Optional[str] = None


@dataclass
class Job:
    id: str
    name: str
    status: str
    start_url: str
    priority: int = 5
    retry_count: int = 0
    max_retries: int = 3
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None
    results_summary: Optional[Dict] = None
    steps_count: int = 0
    shadow_mode: bool = False


@dataclass
class Step:
    id: str
    job_id: str
    action_type: str
    order: int = 0
    selector: Optional[str] = None
    value: Optional[str] = None
    options: Dict = field(default_factory=dict)


@dataclass
class Project:
    id: str
    name: str
    description: Optional[str] = None
    status: str = "active"
    color: Optional[str] = None


@dataclass
class Proxy:
    id: str
    name: str
    server: str
    protocol: str = "http"
    ip_type: str = "datacenter"
    provider: str = "custom"
    country: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    asn: Optional[str] = None
    zip_code: Optional[str] = None
    active: bool = True


@dataclass
class Profile:
    id: str
    name: str
    description: Optional[str] = None
    has_cookies: bool = False
    has_storage_state: bool = False
    last_used: Optional[str] = None