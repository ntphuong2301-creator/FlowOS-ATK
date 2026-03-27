import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, tasksTable } from "@workspace/db/schema";
import { count, eq, and, lt, sql } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth.js";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/stats", async (req: AuthenticatedRequest, res) => {
  try {
    const [totalProjectsRow] = await db.select({ count: count() }).from(projectsTable);
    const [activeProjectsRow] = await db.select({ count: count() }).from(projectsTable).where(eq(projectsTable.status, "active"));
    const [totalTasksRow] = await db.select({ count: count() }).from(tasksTable);
    const [completedTasksRow] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.status, "done"));
    const [inProgressTasksRow] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.status, "in_progress"));
    const [overdueTasksRow] = await db.select({ count: count() }).from(tasksTable)
      .where(and(lt(tasksTable.dueDate, new Date()), sql`${tasksTable.status} != 'done'`));

    const recentTasks = await db.select({
      id: tasksTable.id,
      title: tasksTable.title,
      status: tasksTable.status,
      createdAt: tasksTable.createdAt,
    }).from(tasksTable).orderBy(tasksTable.createdAt).limit(10);

    const recentActivity = recentTasks.map(t => ({
      id: t.id,
      type: "task",
      description: `Công việc "${t.title}" - ${t.status === "done" ? "Hoàn thành" : t.status === "in_progress" ? "Đang làm" : "Cần làm"}`,
      createdAt: t.createdAt,
    }));

    const taskCompletionByDay = await db
      .select({
        date: sql<string>`DATE(${tasksTable.createdAt})::text`,
        created: count(),
      })
      .from(tasksTable)
      .groupBy(sql`DATE(${tasksTable.createdAt})`)
      .orderBy(sql`DATE(${tasksTable.createdAt})`)
      .limit(30);

    const completedByDay = await db
      .select({
        date: sql<string>`DATE(${tasksTable.updatedAt})::text`,
        completed: count(),
      })
      .from(tasksTable)
      .where(eq(tasksTable.status, "done"))
      .groupBy(sql`DATE(${tasksTable.updatedAt})`)
      .orderBy(sql`DATE(${tasksTable.updatedAt})`)
      .limit(30);

    const completedMap = new Map(completedByDay.map(d => [d.date, d.completed]));
    const tasksByDay = taskCompletionByDay.map(d => ({
      date: d.date,
      completed: completedMap.get(d.date) || 0,
      created: d.created,
    }));

    res.json({
      totalProjects: totalProjectsRow.count,
      activeProjects: activeProjectsRow.count,
      totalTasks: totalTasksRow.count,
      completedTasks: completedTasksRow.count,
      inProgressTasks: inProgressTasksRow.count,
      overdueTasks: overdueTasksRow.count,
      recentActivity,
      taskCompletionByDay: tasksByDay,
    });
  } catch (err) {
    req.log.error({ err }, "Get dashboard stats error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

export default router;
