import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { step_name, step_data = {}, complete = false } = body;

    // Get or create onboarding profile
    const existing = await base44.entities.OnboardingProfile.filter({}).catch(() => []);
    let profile = existing[0];

    const stepIndex = STEP_NAMES.indexOf(step_name);
    if (stepIndex === -1) {
      return Response.json({ error: 'Unknown step: ' + step_name }, { status: 400 });
    }

    // Build updated steps array
    const currentSteps = profile?.onboarding_steps || [];
    const existingStepIdx = currentSteps.findIndex(s => s.step === step_name);
    const stepEntry = {
      step: step_name,
      completed: complete,
      completed_at: complete ? new Date().toISOString() : undefined,
    };
    if (existingStepIdx >= 0) {
      currentSteps[existingStepIdx] = stepEntry;
    } else {
      currentSteps.push(stepEntry);
    }

    const updateData: any = {
      ...step_data,
      onboarding_steps: currentSteps,
      current_step: stepIndex,
    };

    if (profile) {
      profile = await base44.entities.OnboardingProfile.update(profile.id, updateData);
    } else {
      profile = await base44.entities.OnboardingProfile.create({
        completed: false,
        current_step: stepIndex,
        onboarding_steps: [stepEntry],
        ...step_data,
      });
    }

    return Response.json({ success: true, profile });
  } catch (error) {
    console.error('saveOnboardingStep error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

const STEP_NAMES = ['welcome', 'goal', 'data', 'agent', 'test', 'live'];