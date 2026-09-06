import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { getProjectStatus, getServiceInstanceLimits, getProjectMeta } from "../../shared/railwayClient.ts";

// Fetches the full Railway project status — services, deployments, domains, resource limits.
export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const status = await getProjectStatus();
    const { projectId, environmentId } = await getProjectMeta();

    // Fetch resource limits for each deployed service instance
    const servicesWithLimits = await Promise.all(
      status.services.map(async (service) => {
        const instancesWithLimits = await Promise.all(
          service.instances.map(async (inst) => {
            if (!inst.deployed) return inst;
            try {
              const limits = await getServiceInstanceLimits(inst.environmentId, service.id);
              return { ...inst, limits: limits.effective, limitsOverride: limits.override };
            } catch {
              return inst;
            }
          })
        );
        return { ...service, instances: instancesWithLimits };
      })
    );

    // Compute summary
    const allInstances = servicesWithLimits.flatMap((s) => s.instances);
    const healthy = allInstances.filter((i) => i.latestDeployment?.status === "SUCCESS").length;
    const failed = allInstances.filter((i) => i.latestDeployment?.status === "FAILED").length;
    const notDeployed = allInstances.filter((i) => !i.deployed).length;
    const sleeping = allInstances.filter((i) => i.sleeping).length;

    return Response.json({
      ok: true,
      project: status.project,
      environments: status.environments,
      services: servicesWithLimits,
      summary: {
        total_services: servicesWithLimits.length,
        total_instances: allInstances.length,
        healthy,
        failed,
        not_deployed: notDeployed,
        sleeping,
      },
      project_id: projectId,
      environment_id: environmentId,
      checked_at: new Date().toISOString(),
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