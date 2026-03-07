export interface StudioSession {
  sessionId: string;
  placeId?: string;
  placeName?: string;
  universeId?: string;
  creatorType?: string;
  creatorId?: string;
  lastHeartbeat: number;
}

export interface StudioCommand {
  commandType: string;
  instancePath: string;
  source: string;
}

export const studioSessions = new Map<string, StudioSession>();
export const commandQueues = new Map<string, StudioCommand[]>();

export function cleanupStaleSessions(timeoutMs: number = 30000): void {
  const now = Date.now();
  for (const [sessionId, session] of studioSessions.entries()) {
    if (now - session.lastHeartbeat > timeoutMs) {
      studioSessions.delete(sessionId);
      commandQueues.delete(sessionId);
    }
  }
}
