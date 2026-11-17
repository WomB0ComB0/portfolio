/** Cached reachability of published content links; independent of any browser or server API. */
export type LinkHealthScope = 'projects' | 'media' | 'certifications' | 'experience';
export type LinkHealthStatus = 'reachable' | 'unavailable' | 'temporary' | 'unknown';
export interface LinkHealthEntry {
  status: LinkHealthStatus;
  checkedAt: string;
}
export interface LinkHealthResponse {
  links: Record<string, LinkHealthEntry>;
}
export interface LinkObservation {
  kind: 'reachable' | 'missing' | 'temporary' | 'unknown';
  httpStatus?: number;
}
