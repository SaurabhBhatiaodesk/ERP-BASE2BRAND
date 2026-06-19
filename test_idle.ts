import { buildShiftEmployee } from "./src/lib/shiftTimeline";

const emp = buildShiftEmployee({
  id: "test",
  name: "Deepak",
  avatar: "D",
  role: "dev",
  dept: "dev",
  session: {
    id: "1",
    employeeId: "test",
    employeeName: "Deepak",
    clockIn: new Date(Date.now() - 80 * 60000).toISOString(),
    status: "active",
    hours: 0,
    segments: [],
    date: "2026-06-19"
  },
  lastActiveAt: new Date(Date.now() - 75 * 60000).toISOString()
});

console.log(emp.status);
