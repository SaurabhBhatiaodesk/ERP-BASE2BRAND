function isoToTimelineMinutes(iso: string): number {
  const d = new Date(iso);
  const clockMin = d.getHours() * 60 + d.getMinutes();
  return clockMin - 600;
}

const lastActiveAt = new Date(Date.now() - 5 * 60000).toISOString();
const clockIn = new Date(Date.now() - 15 * 60000).toISOString();

const lastBlock = {
  kind: "working",
  label: "Office attendance",
  start: isoToTimelineMinutes(clockIn),
  end: null
};

const timeline = [lastBlock];
let currentStatus = "working";
const idleMins = 5;

if (currentStatus === "working" && lastActiveAt) {
  if (idleMins > 2) {
    currentStatus = "idle";
    const block = timeline[timeline.length - 1];
    if (block && block.kind === "working" && block.end === null) {
      const idleStartMin = isoToTimelineMinutes(lastActiveAt);
      const finalIdleStart = Math.max(idleStartMin, block.start);
      block.end = finalIdleStart;
      timeline.push({
        kind: "idle",
        label: "Idle",
        start: finalIdleStart,
        end: null
      });
    }
  }
}

console.log(timeline);
