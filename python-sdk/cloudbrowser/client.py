"""
Cloud Browser API Client
"""

import requests
import json
from typing import Optional, List, Dict, Any
from .models import Session, Job, Step, Project, Proxy, Profile


class CloudBrowser:
    """
    Client for the Cloud Browser automation platform.

    Args:
        api_key: Your API key (from Dashboard > Settings > API Keys)
        base_url: API base URL (default: https://cloud-browser.base44.app/functions/apiGateway)

    Example:
        client = CloudBrowser(api_key="cb_live_xxx")
        session = client.sessions.create(url="https://example.com")
        job = client.jobs.create(name="My Job", start_url="https://example.com")
        client.jobs.run(job.id)
    """

    def __init__(self, api_key: str, base_url: str = "https://cloud-browser.base44.app/functions/apiGateway"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        self.sessions = SessionManager(self)
        self.jobs = JobManager(self)
        self.steps = StepManager(self)
        self.projects = ProjectManager(self)
        self.proxies = ProxyManager(self)
        self.profiles = ProfileManager(self)

    def _request(self, method: str, path: str, data: Optional[Dict] = None) -> Any:
        url = f"{self.base_url}/{path.lstrip('/')}"
        resp = requests.request(method, url, headers=self.headers, json=data)
        resp.raise_for_status()
        return resp.json()

    def health(self) -> Dict:
        """Check engine health."""
        return self._request("GET", "health")

    def metrics(self) -> Dict:
        """Get platform metrics."""
        return self._request("GET", "metrics")


class BaseManager:
    def __init__(self, client: CloudBrowser):
        self.client = client
        self.entity = self._entity_name()

    def _entity_name(self) -> str:
        raise NotImplementedError

    def list(self, limit: int = 50, sort: str = "-updated_date") -> List[Dict]:
        return self.client._request("GET", f"{self.entity}?limit={limit}&sort={sort}")

    def get(self, id: str) -> Dict:
        return self.client._request("GET", f"{self.entity}/{id}")

    def create(self, **kwargs) -> Dict:
        return self.client._request("POST", self.entity, data=kwargs)

    def update(self, id: str, **kwargs) -> Dict:
        return self.client._request("PATCH", f"{self.entity}/{id}", data=kwargs)

    def delete(self, id: str) -> None:
        self.client._request("DELETE", f"{self.entity}/{id}")


class SessionManager(BaseManager):
    def _entity_name(self): return "sessions"

    def create(self, url: str, viewport: Optional[Dict] = None, proxy_id: Optional[str] = None,
               user_agent: Optional[str] = None, **kwargs) -> Dict:
        return super().create(target_url=url, viewport=viewport, proxy_id=proxy_id,
                              user_agent=user_agent, **kwargs)

    def screenshot(self, id: str) -> Dict:
        return self.client._request("POST", f"sessions/{id}/screenshot")

    def extract(self, id: str, selector: str, output_schema: Optional[Dict] = None) -> Dict:
        return self.client._request("POST", f"sessions/{id}/extract",
                                    data={"selector": selector, "output_schema": output_schema})


class JobManager(BaseManager):
    def _entity_name(self): return "jobs"

    def create(self, name: str, start_url: str, priority: int = 5, **kwargs) -> Dict:
        return super().create(name=name, start_url=start_url, priority=priority, **kwargs)

    def run(self, id: str) -> Dict:
        return self.client._request("POST", f"jobs/{id}/run")

    def cancel(self, id: str) -> Dict:
        return self.client._request("POST", f"jobs/{id}/cancel")

    def retry(self, id: str) -> Dict:
        return self.client._request("POST", f"jobs/{id}/retry")


class StepManager(BaseManager):
    def _entity_name(self): return "steps"

    def create(self, job_id: str, action_type: str, order: int = 0, **kwargs) -> Dict:
        return super().create(job_id=job_id, action_type=action_type, order=order, **kwargs)


class ProjectManager(BaseManager):
    def _entity_name(self): return "projects"

    def create(self, name: str, description: str = "", **kwargs) -> Dict:
        return super().create(name=name, description=description, **kwargs)


class ProxyManager(BaseManager):
    def _entity_name(self): return "proxies"

    def create(self, name: str, server: str, protocol: str = "http",
               ip_type: str = "datacenter", provider: str = "custom",
               country: Optional[str] = None, city: Optional[str] = None,
               state: Optional[str] = None, asn: Optional[str] = None,
               zip_code: Optional[str] = None, **kwargs) -> Dict:
        return super().create(name=name, server=server, protocol=protocol,
                             ip_type=ip_type, provider=provider, country=country,
                             city=city, state=state, asn=asn, zip_code=zip_code, **kwargs)

    def test(self, id: str) -> Dict:
        return self.client._request("POST", f"proxies/{id}/test")


class ProfileManager(BaseManager):
    def _entity_name(self): return "profiles"

    def create(self, name: str, **kwargs) -> Dict:
        return super().create(name=name, **kwargs)