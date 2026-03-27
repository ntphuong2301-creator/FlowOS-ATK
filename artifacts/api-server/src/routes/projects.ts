import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, projectMembersTable, tasksTable, usersTable } from "@workspace/db/schema";
import { eq, count, and, sql } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth.js";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
    const result = await Promise.all(
      projects.map(async (p) => {
        const [owner] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, avatar: usersTable.avatar, role: usersTable.role, createdAt: usersTable.createdAt })
          .from(usersTable).where(eq(usersTable.id, p.ownerId)).limit(1);
        const [memberCountRow] = await db.select({ count: count() }).from(projectMembersTable).where(eq(projectMembersTable.projectId, p.id));
        const [taskCountRow] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.projectId, p.id));
        const [completedCountRow] = await db.select({ count: count() }).from(tasksTable).where(and(eq(tasksTable.projectId, p.id), eq(tasksTable.status, "done")));
        return {
          ...p,
          owner,
          memberCount: memberCountRow.count,
          taskCount: taskCountRow.count,
          completedTaskCount: completedCountRow.count,
        };
      })
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "List projects error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name) {
      res.status(400).json({ message: "Tên dự án là bắt buộc" });
      return;
    }
    const [project] = await db.insert(projectsTable).values({
      name,
      description,
      color: color || "#008264",
      ownerId: req.userId!,
    }).returning();

    const [owner] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, avatar: usersTable.avatar, role: usersTable.role, createdAt: usersTable.createdAt })
      .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);

    res.status(201).json({ ...project, owner, memberCount: 0, taskCount: 0, completedTaskCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Create project error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.id)).limit(1);
    if (!project) {
      res.status(404).json({ message: "Dự án không tồn tại" });
      return;
    }
    const [owner] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, avatar: usersTable.avatar, role: usersTable.role, createdAt: usersTable.createdAt })
      .from(usersTable).where(eq(usersTable.id, project.ownerId)).limit(1);
    const [memberCountRow] = await db.select({ count: count() }).from(projectMembersTable).where(eq(projectMembersTable.projectId, project.id));
    const [taskCountRow] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.projectId, project.id));
    const [completedCountRow] = await db.select({ count: count() }).from(tasksTable).where(and(eq(tasksTable.projectId, project.id), eq(tasksTable.status, "done")));

    res.json({ ...project, owner, memberCount: memberCountRow.count, taskCount: taskCountRow.count, completedTaskCount: completedCountRow.count });
  } catch (err) {
    req.log.error({ err }, "Get project error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.put("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, color, status } = req.body;
    const [project] = await db.update(projectsTable)
      .set({ name, description, color, status, updatedAt: new Date() })
      .where(eq(projectsTable.id, req.params.id))
      .returning();
    if (!project) {
      res.status(404).json({ message: "Dự án không tồn tại" });
      return;
    }
    const [owner] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, avatar: usersTable.avatar, role: usersTable.role, createdAt: usersTable.createdAt })
      .from(usersTable).where(eq(usersTable.id, project.ownerId)).limit(1);
    const [memberCountRow] = await db.select({ count: count() }).from(projectMembersTable).where(eq(projectMembersTable.projectId, project.id));
    const [taskCountRow] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.projectId, project.id));
    const [completedCountRow] = await db.select({ count: count() }).from(tasksTable).where(and(eq(tasksTable.projectId, project.id), eq(tasksTable.status, "done")));
    res.json({ ...project, owner, memberCount: memberCountRow.count, taskCount: taskCountRow.count, completedTaskCount: completedCountRow.count });
  } catch (err) {
    req.log.error({ err }, "Update project error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    await db.delete(projectsTable).where(eq(projectsTable.id, req.params.id));
    res.json({ message: "Đã xóa dự án" });
  } catch (err) {
    req.log.error({ err }, "Delete project error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.get("/:id/stats", async (req: AuthenticatedRequest, res) => {
  try {
    const projectId = req.params.id;
    const [totalRow] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.projectId, projectId));
    const [completedRow] = await db.select({ count: count() }).from(tasksTable).where(and(eq(tasksTable.projectId, projectId), eq(tasksTable.status, "done")));
    const [inProgressRow] = await db.select({ count: count() }).from(tasksTable).where(and(eq(tasksTable.projectId, projectId), eq(tasksTable.status, "in_progress")));
    const [todoRow] = await db.select({ count: count() }).from(tasksTable).where(and(eq(tasksTable.projectId, projectId), eq(tasksTable.status, "todo")));

    const total = totalRow.count;
    const completed = completedRow.count;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    const tasksByDay = await db
      .select({ date: sql<string>`DATE(${tasksTable.createdAt})::text`, count: count() })
      .from(tasksTable)
      .where(eq(tasksTable.projectId, projectId))
      .groupBy(sql`DATE(${tasksTable.createdAt})`)
      .orderBy(sql`DATE(${tasksTable.createdAt})`);

    res.json({
      totalTasks: total,
      completedTasks: completed,
      inProgressTasks: inProgressRow.count,
      todoTasks: todoRow.count,
      completionRate,
      tasksByDay,
    });
  } catch (err) {
    req.log.error({ err }, "Get project stats error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

export default router;
