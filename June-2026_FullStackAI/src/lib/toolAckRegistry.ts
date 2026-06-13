/** Tracks TOOL_ACK per call_id across Strict Mode double-mounts and replays. */
const acknowledged = new Set<string>();

export function markToolAckSent(callId: string): boolean {
  if (acknowledged.has(callId)) return false;
  acknowledged.add(callId);
  return true;
}

export function resetToolAckRegistry(): void {
  acknowledged.clear();
}
