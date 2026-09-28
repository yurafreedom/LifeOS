import {
  dateOnlyAfterEndOfDay,
  LIFEOS_TIME_ZONE,
  localDateForInstant,
  parseDateOnly,
} from './timezone';

export const PROJECT_TIME_ZONE = LIFEOS_TIME_ZONE;

type ProjectIdentity = { id: string | number; title?: string };

export type AnalyticsQueueRequest = {
  operation_type: 'forecast.append' | 'measurement.append';
  route: '/api/v1/aa/forecasts' | '/api/v1/aa/measurements';
  payload: Record<string, unknown>;
};

const subjectFor = (project: ProjectIdentity) => ({
  domain: 'project',
  type: 'project',
  id: String(project.id),
});

export function projectForecastQueueRequest(
  project: ProjectIdentity,
  forecastDate: string,
): AnalyticsQueueRequest {
  parseDateOnly(forecastDate);
  return {
    operation_type: 'forecast.append',
    route: '/api/v1/aa/forecasts',
    payload: {
      subject: subjectFor(project),
      metric_key: 'project.completion_date',
      value: { type: 'date', date: forecastDate },
      horizon_at: dateOnlyAfterEndOfDay(forecastDate, PROJECT_TIME_ZONE),
      provenance: {
        source_kind: 'USER_REPORTED',
        basis: 'Прогноз завершения проекта пользователя',
        method: 'MANUAL_FORECAST',
      },
    },
  };
}

export function projectCompletionQueueRequest(
  project: ProjectIdentity,
  completedAt: string | number | Date,
): AnalyticsQueueRequest {
  const instant = new Date(completedAt);
  if (!Number.isFinite(instant.getTime())) {
    throw new TypeError(`Invalid completion instant: ${String(completedAt)}`);
  }
  const occurredAt = instant.toISOString();
  return {
    operation_type: 'measurement.append',
    route: '/api/v1/aa/measurements',
    payload: {
      subject: subjectFor(project),
      metric_key: 'project.completion_date',
      value: {
        type: 'date',
        date: localDateForInstant(occurredAt, PROJECT_TIME_ZONE),
      },
      occurred_at: occurredAt,
      occurred_tz: PROJECT_TIME_ZONE,
      provenance: {
        source_kind: 'OBSERVED',
        basis: 'Фактическое завершение проекта',
        method: 'PROJECT_COMPLETION',
      },
    },
  };
}
