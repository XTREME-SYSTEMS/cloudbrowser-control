"""
Cloud Browser Python SDK
A Python client for the Cloud Browser automation platform REST API.
"""

from .client import CloudBrowser
from .models import (
    Session, Job, Step, Project, Proxy, Profile,
    SessionConfig, JobConfig, StepConfig, ProxyConfig,
)

__version__ = "1.0.0"
__all__ = [
    "CloudBrowser",
    "Session", "Job", "Step", "Project", "Proxy", "Profile",
    "SessionConfig", "JobConfig", "StepConfig", "ProxyConfig",
]