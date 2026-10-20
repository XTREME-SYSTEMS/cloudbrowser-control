import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

/**
 * One catalogue, one fetch, shared by every surface that shows it — the
 * dashboard, the service pages and the marketing site. Cached at module level
 * so navigating between pages does not re-request it, and so the marketing
 * page and the admin console can never describe different services.
 */
let cachedServices = null;
let inflight = null;

function fetchCatalog() {
  if (!inflight) {
    inflight = base44.functions
      .invoke("getServiceCatalog", {})
      .then((res) => {
        const data = res?.data || res;
        if (!Array.isArray(data?.services)) {
          throw new Error(data?.error || "The service catalogue came back empty.");
        }
        cachedServices = data.services;
        return data;
      })
      .catch((error) => {
        inflight = null;
        throw error;
      });
  }
  return inflight;
}

export function useServiceCatalog() {
  const [services, setServices] = useState(cachedServices);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!cachedServices);

  useEffect(() => {
    if (cachedServices) return;
    let cancelled = false;
    fetchCatalog()
      .then((data) => {
        if (!cancelled) setServices(data.services);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Could not load the service catalogue.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const serviceFor = (slug) => (services || []).find((s) => s.slug === slug) || null;

  return { services: services || [], loading, error, serviceFor };
}