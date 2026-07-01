import { useState, useEffect } from "react";
import { fetchEmployeeHistoricalSessions, clockSessionsToAttendanceWindows } from "@/lib/database";
import { AppTask } from "@/lib/database";
import { ShiftEmployee } from "./ShiftView";
import { buildShiftEmployee } from "@/lib/shiftTimeline";
import { listWorkTasksForEmployee, listTrackedTasksForEmployee, aggregateStageSeconds, STAGE_ORDER } from "@/lib/taskStageTime";

export function useEmployeeVisualHistory(emp: ShiftEmployee, rangeDays: number, allTasks: AppTask[]) {
  const [historyDays, setHistoryDays] = useState<{ date: string; data: ShiftEmployee; attendanceWindows: ReturnType<typeof clockSessionsToAttendanceWindows> }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!emp || !emp.id) return;
      setLoading(true);
      
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(start.getDate() - rangeDays);
      start.setHours(0, 0, 0, 0);

      try {
        const sessions = await fetchEmployeeHistoricalSessions(emp.id, start.toISOString(), end.toISOString());
        
        const daysMap = new Map<string, typeof sessions[0]>();
        
        for (const s of sessions) {
          if (!s.clockIn) continue;
          // Simple local date YYYY-MM-DD
          const d = new Date(s.clockIn);
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          
          if (!daysMap.has(dateStr) || (s.clockOut && !daysMap.get(dateStr)!.clockOut)) {
             daysMap.set(dateStr, s);
          } else if (daysMap.has(dateStr)) {
             const existing = daysMap.get(dateStr)!;
             existing.segments = [...(existing.segments || []), ...(s.segments || [])];
             if (s.clockOut && (!existing.clockOut || new Date(s.clockOut) > new Date(existing.clockOut))) {
               existing.clockOut = s.clockOut;
             }
          }
        }

        const daysList = Array.from(daysMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
        
        const workTasksInput = listWorkTasksForEmployee(allTasks, emp.id, emp.name);
        const trackedTasksInput = listTrackedTasksForEmployee(allTasks, emp.id, emp.name);

        const result = daysList.map(([dateStr, session]) => {
          const activeTasksForDay = trackedTasksInput.filter(t => {
            const totals = aggregateStageSeconds(t.stageHistory || [], t.status, t.statusEnteredAt, dateStr);
            const totalSecs = STAGE_ORDER.reduce((sum, s) => sum + (totals[s] || 0), 0);
            return totalSecs > 0;
          });

          return {
            date: dateStr,
            attendanceWindows: clockSessionsToAttendanceWindows([session]),
            data: buildShiftEmployee({
              id: emp.id,
              name: emp.name,
              avatar: emp.avatar,
              role: emp.role,
              dept: emp.dept,
              session,
              workTasksInput: activeTasksForDay,
              trackedTasksInput: activeTasksForDay,
              targetDate: dateStr,
            })
          };
        });

        setHistoryDays(result);
      } catch (err) {
        console.error("Failed to load historical sessions", err);
      }
      setLoading(false);
    }
    load();
  }, [emp, rangeDays, allTasks]);

  return { historyDays, loading };
}
