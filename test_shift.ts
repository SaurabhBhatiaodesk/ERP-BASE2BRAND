import { buildShiftEmployee } from "./src/lib/shiftTimeline.ts";

const mockSession = {
  id: "test",
  employeeId: "emp1",
  employeeName: "Deepak",
  clockIn: new Date(Date.now() - 15 * 60000).toISOString(), // 15 mins ago
  clockOut: null,
  status: "active",
  hours: 0
};

const mockProfile = {
  id: "emp1",
  name: "Deepak",
  role: "Dev",
  dept: "Engineering",
  email: "deepak@test.com",
  phone: "",
  location: "",
  joined: "",
  score: 100,
  status: "working",
  salary: "",
  manager: "",
  skills: [],
  weeklyHours: [],
  attendance: 100,
  leaves: 0,
  projects: 0,
  revenue: 0,
  last_active_at: new Date(Date.now() - 5 * 60000).toISOString() // 5 mins ago
};

const emp = buildShiftEmployee({
  ...mockProfile,
  session: mockSession,
  avatar: "D",
  targetDate: undefined
});

console.log("Timeline:");
console.dir(emp.timeline, { depth: null });
console.log("Idle Duration Mins:", emp.idleDurationMins);
console.log("Status:", emp.status);
