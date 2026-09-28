import { parseDateOnly } from '../analytics/timezone';

export type ProjectStatus = 'active' | 'completed' | 'archived';

export type LifeProject = {
  id: string;
  title: string;
  created_at: string;
  started_at: string;
  status: ProjectStatus;
  current_forecast_date: string | null;
  completed_at: string | null;
};

export const PROJECT_STATUSES: ReadonlySet<ProjectStatus> = new Set([
  'active',
  'completed',
  'archived',
]);

type DurableEnqueue = (project: LifeProject, value: string) => Promise<unknown>;

function defaultProjectId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `project-${globalThis.crypto.randomUUID()}`;
  }
  return `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function validInstant(value: string | number | Date): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Project timestamp is invalid.');
  return date.toISOString();
}

function requireActive(project: LifeProject): void {
  if (project.status !== 'active') throw new Error('Only an active Project can use this action.');
}

export function validateProjectRecord(value: unknown): LifeProject {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Project data is invalid.');
  }
  const project = value as Record<string, unknown>;
  if (typeof project.id !== 'string' || !project.id) throw new TypeError('Project id is invalid.');
  if (typeof project.title !== 'string' || !project.title.trim()) {
    throw new TypeError('Project title is invalid.');
  }
  if (typeof project.created_at !== 'string' || typeof project.started_at !== 'string') {
    throw new TypeError('Project timestamps are invalid.');
  }
  validInstant(project.created_at);
  validInstant(project.started_at);
  if (!PROJECT_STATUSES.has(project.status as ProjectStatus)) {
    throw new TypeError('Project status is invalid.');
  }
  if (project.current_forecast_date != null) {
    if (typeof project.current_forecast_date !== 'string') {
      throw new TypeError('Project forecast date is invalid.');
    }
    parseDateOnly(project.current_forecast_date);
  }
  if (project.completed_at != null) {
    if (typeof project.completed_at !== 'string') {
      throw new TypeError('Project completion timestamp is invalid.');
    }
    validInstant(project.completed_at);
  }
  if (project.status === 'active' && project.completed_at != null) {
    throw new TypeError('An active Project cannot have a completion timestamp.');
  }
  if (project.status === 'completed' && project.completed_at == null) {
    throw new TypeError('A completed Project requires a completion timestamp.');
  }
  return value as LifeProject;
}

export function createProjectRecord(
  title: string,
  now: string | number | Date = new Date(),
  id = defaultProjectId(),
): LifeProject {
  const cleanTitle = String(title ?? '').trim();
  if (!cleanTitle) throw new TypeError('Project title is required.');
  const createdAt = validInstant(now);
  return {
    id,
    title: cleanTitle,
    created_at: createdAt,
    started_at: createdAt,
    status: 'active',
    current_forecast_date: null,
    completed_at: null,
  };
}

export async function setProjectForecastWithDurableIntent(
  project: LifeProject,
  forecastDate: string,
  enqueue: DurableEnqueue,
): Promise<LifeProject> {
  requireActive(project);
  parseDateOnly(forecastDate);
  const queued = await enqueue(project, forecastDate);
  if (!queued) throw new Error('Project forecast was not durably queued.');
  return { ...project, current_forecast_date: forecastDate };
}

export async function completeProjectWithDurableIntent(
  project: LifeProject,
  completedAt: string | number | Date,
  enqueue: DurableEnqueue,
): Promise<LifeProject> {
  requireActive(project);
  const completionInstant = validInstant(completedAt);
  const queued = await enqueue(project, completionInstant);
  if (!queued) throw new Error('Project completion was not durably queued.');
  return { ...project, status: 'completed', completed_at: completionInstant };
}

export function archiveProjectRecord(project: LifeProject): LifeProject {
  if (project.status !== 'active' && project.status !== 'completed') {
    throw new Error('Only an active or completed Project can be archived.');
  }
  return { ...project, status: 'archived' };
}
