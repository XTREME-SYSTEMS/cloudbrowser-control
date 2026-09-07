import { secrets } from "base44:runtime";

// Railway GraphQL API client — uses Project-Access-Token header (not Bearer)
const RAILWAY_GRAPHQL_URL = "https://backboard.railway.app/graphql/v2";

// Cached project metadata (resolved on first use)
let cachedProjectId: string | null = null;
let cachedEnvId: string | null = null;

/**
 * Execute a GraphQL query or mutation against the Railway API.
 * Uses the Project-Access-Token header (project-scoped tokens don't use Bearer).
 */
export async function railwayGraphQL<T = any>(
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const token = secrets.get("RAILWAY_TOKEN");
  if (!token) throw new Error("RAILWAY_TOKEN secret not set");

  // Hard 10s timeout — prevents the browser fetch from aborting with "Failed to fetch"
  // when Railway API is slow (e.g., during active deployments)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  let res: Response;
  try {
    res = await fetch(RAILWAY_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Project-Access-Token": token.trim(),
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Railway API timeout (10s) — API may be slow during deployments");
    }
    throw new Error(`Railway API unreachable: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json();

  if (data.errors?.length) {
    const msg = data.errors[0].message;
    if (msg === "Not Authorized") {
      throw new Error("Railway token not authorized — ensure RAILWAY_TOKEN is a project access token with full scope");
    }
    throw new Error(`Railway GraphQL error: ${msg}`);
  }

  return data.data as T;
}

/**
 * Resolve the project ID and environment ID from the project token.
 * Caches the result for subsequent calls.
 */
export async function getProjectMeta(): Promise<{ projectId: string; environmentId: string }> {
  if (cachedProjectId && cachedEnvId) {
    return { projectId: cachedProjectId, environmentId: cachedEnvId };
  }

  const data = await railwayGraphQL<{
    projectToken: { projectId: string; environmentId: string; project: { name: string } };
  }>(`query { projectToken { id name projectId environmentId project { id name } } }`);

  cachedProjectId = data.projectToken.projectId;
  cachedEnvId = data.projectToken.environmentId;

  return { projectId: cachedProjectId!, environmentId: cachedEnvId! };
}

/**
 * Fetch all services in the project with their deployment status, domains,
 * resource limits, and latest deployment info.
 */
export async function getProjectStatus() {
  const { projectId } = await getProjectMeta();

  const query = `
    query($projectId: String!) {
      project(id: $projectId) {
        id
        name
        description
        environments {
          edges { node { id name isEphemeral } }
        }
        services {
          edges {
            node {
              id
              name
              icon
              createdAt
              serviceInstances {
                edges {
                  node {
                    id
                    serviceName
                    environmentId
                    region
                    upstreamUrl
                    hasEverDeployed
                    isUpdatable
                    numReplicas
                    source { repo image }
                    builder
                    startCommand
                    rootDirectory
                    sleepApplication
                    latestDeployment {
                      id
                      status
                      createdAt
                      statusUpdatedAt
                      canRedeploy
                      canRollback
                    }
                    domains {
                      customDomains { domain }
                      serviceDomains { domain }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await railwayGraphQL<{
    project: {
      id: string;
      name: string;
      description: string;
      environments: { edges: { node: { id: string; name: string; isEphemeral: boolean } }[] };
      services: {
        edges: {
          node: {
            id: string;
            name: string;
            icon: string | null;
            createdAt: string;
            serviceInstances: {
              edges: {
                node: {
                  id: string;
                  serviceName: string;
                  environmentId: string;
                  region: string | null;
                  upstreamUrl: string | null;
                  hasEverDeployed: boolean;
                  isUpdatable: boolean;
                  numReplicas: number | null;
                  source: { repo: string | null; image: string | null } | null;
                  builder: string;
                  startCommand: string | null;
                  rootDirectory: string | null;
                  sleepApplication: boolean | null;
                  latestDeployment: {
                    id: string;
                    status: string;
                    createdAt: string;
                    statusUpdatedAt: string;
                    canRedeploy: boolean;
                    canRollback: boolean;
                  } | null;
                  domains: {
                    customDomains: { domain: string }[];
                    serviceDomains: { domain: string }[];
                  } | null;
                };
              }[];
            };
          };
        }[];
      };
    };
  }>(query, { projectId });

  const project = data.project;
  const environments = project.environments.edges.map((e) => e.node);
  const services = project.services.edges.map((e) => {
    const s = e.node;
    const instances = s.serviceInstances.edges.map((si) => {
      const n = si.node;
      return {
        id: n.id,
        name: n.serviceName,
        environmentId: n.environmentId,
        region: n.region,
        url: n.upstreamUrl,
        deployed: n.hasEverDeployed,
        updatable: n.isUpdatable,
        replicas: n.numReplicas,
        repo: n.source?.repo,
        image: n.source?.image,
        builder: n.builder,
        startCommand: n.startCommand,
        rootDirectory: n.rootDirectory,
        sleeping: n.sleepApplication,
        latestDeployment: n.latestDeployment
          ? {
              id: n.latestDeployment.id,
              status: n.latestDeployment.status,
              createdAt: n.latestDeployment.createdAt,
              statusUpdatedAt: n.latestDeployment.statusUpdatedAt,
              canRedeploy: n.latestDeployment.canRedeploy,
              canRollback: n.latestDeployment.canRollback,
            }
          : null,
        customDomains: n.domains?.customDomains?.map((d) => d.domain) || [],
        serviceDomains: n.domains?.serviceDomains?.map((d) => d.domain) || [],
      };
    });
    return {
      id: s.id,
      name: s.name,
      icon: s.icon,
      createdAt: s.createdAt,
      instances,
    };
  });

  return {
    project: { id: project.id, name: project.name, description: project.description },
    environments,
    services,
  };
}

/**
 * Fetch recent deployment logs for a specific service instance.
 */
export async function getDeploymentLogs(deploymentId: string, limit = 50) {
  const query = `
    query($deploymentId: String!, $limit: Int!) {
      deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
        edges {
          node {
            timestamp
            message
            stream
          }
        }
      }
    }
  `;

  const data = await railwayGraphQL<{
    deploymentLogs: { edges: { node: { timestamp: string; message: string; stream: string } }[] };
  }>(query, { deploymentId, limit });

  return data.deploymentLogs.edges.map((e) => e.node);
}

/**
 * Fetch resource limits for a service instance.
 */
export async function getServiceInstanceLimits(environmentId: string, serviceId: string) {
  const query = `
    query($environmentId: String!, $serviceId: String!) {
      serviceInstanceLimitOverride(environmentId: $environmentId, serviceId: $serviceId) {
        memoryGB
        vCPUs
      }
      serviceInstanceLimits(environmentId: $environmentId, serviceId: $serviceId) {
        memoryGB
        vCPUs
      }
    }
  `;

  const data = await railwayGraphQL<{
    serviceInstanceLimitOverride: { memoryGB: number | null; vCPUs: number | null } | null;
    serviceInstanceLimits: { memoryGB: number | null; vCPUs: number | null } | null;
  }>(query, { environmentId, serviceId });

  return {
    override: data.serviceInstanceLimitOverride,
    effective: data.serviceInstanceLimits,
  };
}