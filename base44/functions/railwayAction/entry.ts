import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { railwayGraphQL, getProjectMeta, getDeploymentLogs } from "../../shared/railwayClient.ts";

// Performs Railway infrastructure actions: redeploy, restart, stop, rollback, cancel, updateLimits.
export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json();
    const { action, serviceId, deploymentId, memoryGB, vCPUs, rootDirectory } = body;

    if (!action) {
      return Response.json({ ok: false, error: "action is required" }, { status: 400 });
    }

    const { environmentId } = await getProjectMeta();

    let result: any;

    switch (action) {
      case "redeploy": {
        if (!serviceId) throw new Error("serviceId is required for redeploy");
        result = await railwayGraphQL(
          `mutation($environmentId: String!, $serviceId: String!) {
            serviceInstanceRedeploy(environmentId: $environmentId, serviceId: $serviceId)
          }`,
          { environmentId, serviceId }
        );
        break;
      }

      case "deploy_latest": {
        if (!serviceId) throw new Error("serviceId is required for deploy_latest");
        result = await railwayGraphQL(
          `mutation($environmentId: String!, $serviceId: String!) {
            serviceInstanceDeploy(latestCommit: true, environmentId: $environmentId, serviceId: $serviceId)
          }`,
          { environmentId, serviceId }
        );
        break;
      }

      case "restart": {
        if (!deploymentId) throw new Error("deploymentId is required for restart");
        result = await railwayGraphQL(
          `mutation($deploymentId: String!) {
            deploymentRestart(id: $deploymentId)
          }`,
          { deploymentId }
        );
        break;
      }

      case "stop": {
        if (!deploymentId) throw new Error("deploymentId is required for stop");
        result = await railwayGraphQL(
          `mutation($deploymentId: String!) {
            deploymentStop(id: $deploymentId)
          }`,
          { deploymentId }
        );
        break;
      }

      case "rollback": {
        if (!deploymentId) throw new Error("deploymentId is required for rollback");
        result = await railwayGraphQL(
          `mutation($deploymentId: String!) {
            deploymentRollback(id: $deploymentId)
          }`,
          { deploymentId }
        );
        break;
      }

      case "cancel": {
        if (!deploymentId) throw new Error("deploymentId is required for cancel");
        result = await railwayGraphQL(
          `mutation($deploymentId: String!) {
            deploymentCancel(id: $deploymentId)
          }`,
          { deploymentId }
        );
        break;
      }

      case "update_limits": {
        if (!serviceId) throw new Error("serviceId is required for update_limits");
        result = await railwayGraphQL(
          `mutation($environmentId: String!, $serviceId: String!, $memoryGB: Float, $vCPUs: Float) {
            serviceInstanceLimitsUpdate(input: {
              environmentId: $environmentId
              serviceId: $serviceId
              memoryGB: $memoryGB
              vCPUs: $vCPUs
            })
          }`,
          { environmentId, serviceId, memoryGB: memoryGB || null, vCPUs: vCPUs || null }
        );
        break;
      }

      case "update_root_directory": {
        if (!serviceId) throw new Error("serviceId is required for update_root_directory");
        result = await railwayGraphQL(
          `mutation($environmentId: String!, $serviceId: String!, $rootDirectory: String) {
            serviceInstanceUpdate(input: {
              environmentId: $environmentId
              serviceId: $serviceId
              rootDirectory: $rootDirectory
            }) {
              id
              serviceName
              rootDirectory
            }
          }`,
          { environmentId, serviceId, rootDirectory: rootDirectory || "" }
        );
        break;
      }

      case "get_root_directories": {
        const { projectId } = await getProjectMeta();
        const statusData = await railwayGraphQL(
          `query($projectId: String!) {
            project(id: $projectId) {
              services {
                edges {
                  node {
                    id
                    name
                    serviceInstances {
                      edges {
                        node {
                          id
                          serviceName
                          rootDirectory
                          source { repo }
                          latestDeployment {
                            id
                            status
                            createdAt
                            statusUpdatedAt
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }`,
          { projectId }
        );
        const svcList = statusData.project.services.edges.map((e: any) => {
          const s = e.node;
          const inst = s.serviceInstances.edges[0]?.node;
          return {
            serviceId: s.id,
            name: s.name,
            instanceId: inst?.id,
            rootDirectory: inst?.rootDirectory || "",
            repo: inst?.source?.repo || null,
            deploymentStatus: inst?.latestDeployment?.status || "NONE",
            deploymentId: inst?.latestDeployment?.id || null,
            deploymentCreatedAt: inst?.latestDeployment?.createdAt || null,
          };
        });
        return Response.json({ ok: true, action, services: svcList, __v: DEPLOYMENT_VERSION });
      }

      case "get_logs": {
        if (!deploymentId) throw new Error("deploymentId is required for get_logs");
        const logs = await getDeploymentLogs(deploymentId, 100);
        return Response.json({ ok: true, action, logs, __v: DEPLOYMENT_VERSION });
      }

      default:
        return Response.json({
          ok: false,
          error: `Unknown action: ${action}. Valid: redeploy, deploy_latest, restart, stop, rollback, cancel, update_limits, update_root_directory, get_root_directories, get_logs`,
        }, { status: 400 });
    }

    // Log the action to audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        action: `railway_${action}`,
        resource_type: "railway_infrastructure",
        resource_id: serviceId || deploymentId || "unknown",
        details: JSON.stringify({ action, serviceId, deploymentId, memoryGB, vCPUs }),
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Audit log failed:", e.message);
    }

    return Response.json({
      ok: true,
      action,
      result,
      __v: DEPLOYMENT_VERSION,
    }, { status: 200 });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error.message,
      __v: DEPLOYMENT_VERSION,
    }, { status: 500 });
  }
}