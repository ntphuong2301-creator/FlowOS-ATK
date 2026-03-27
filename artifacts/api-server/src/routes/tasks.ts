import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tasksTable, usersTable, projectsTable, projectMembersTable, notificationsTable } from "@workspace/db/schema";
import { eq, and, count } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth.js";

const router: IRouter = Router();
router.use(requireAuth);

async function enrichTask(task: typeof tasksTable.$inferSelect) {
  let assignee = null;
  if (task.assigneeId) {
    const [a] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, avatar: usersTable.avatar, role: usersTable.role, createdAt: usersTable.createdAt })
      .from(usersTable).where(eq(usersTable.id, task.assigneeId)).limit(1);
    assignee = a || null;
  }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, task.projectId)).limit(1);
  let owner = null;
  if (project) {
    const [o] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, avatar: usersTable.avatar, role: usersTable.role, createdAt: usersTable.createdAt })
      .from(usersTable).where(eq(usersTable.id, project.ownerId)).limit(1);
    owner = o;
    const [memberCountRow] = await db.select({ count: count() }).from(projectMembersTable).where(eq(projectMembersTable.projectId, project.id));
    const [taskCountRow] = await db.select({ count: count() }).from(tasksTable).where(eq(tasksTable.projectId, project.id));
    const [completedCountRow] = await db.select({ count: count() }).from(tasksTable).where(and(eq(tasksTable.projectId, project.id), eq(tasksTable.status, "done")));
    return { ...task, assignee, project: { ...project, owner, memberCount: memberCountRow.count, taskCount: taskCountRow.count, completedTaskCount: completedCountRow.count } };
  }
  return { ...task, assignee, project };
}

router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, status, assigneeId } = req.query;
    let conditions = [];
    if (projectId) conditions.push(eq(tasksTable.projectId, projectId as string));
    if (status) conditions.push(eq(tasksTable.status, status as any));
    if (assigneeId) conditions.push(eq(tasksTable.assigneeId, assigneeId as string));

    const tasks = conditions.length > 0
      ? await db.select().from(tasksTable).where(and(...conditions)).orderBy(tasksTable.createdAt)
      : await db.select().from(tasksTable).orderBy(tasksTable.createdAt);

    const result = await Promise.all(tasks.map(enrichTask));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "List tasks error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { title, description, status, priority, projectId, assigneeId, dueDate, tags } = req.body;
    if (!title || !projectId) {
      res.status(400).json({ message: "Tiêu đề và dự án là bắt buộc" });
      return;
    }
    const [task] = await db.insert(tasksTable).values({
      title, description, status: status || "todo", priority: priority || "medium",
      projectId, assigneeId, dueDate: dueDate ? new Date(dueDate) : undefined, tags: tags || [],
    }).returning();

    if (assigneeId && assigneeId !== req.userId) {
      await db.insert(notificationsTable).values({
        title: "Bạn được giao công việc mới",
        message: `Công việc "${title}" đã được giao cho bạn`,
        type: "info",
        userId: assigneeId,
      });
    }

    res.status(201).json(await enrichTask(task));
  } catch (err) {
    req.log.error({ err }, "Create task error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, req.params.id)).limit(1);
    if (!task) {
      res.status(404).json({ message: "Công việc không tồn tại" });
      return;
    }
    res.json(await enrichTask(task));
  } catch (err) {
    req.log.error({ err }, "Get task error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.put("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { title, description, status, priority, assigneeId, dueDate, tags } = req.body;
    const [task] = await db.update(tasksTable)
      .set({ title, description, status, priority, assigneeId, dueDate: dueDate ? new Date(dueDate) : undefined, tags, updatedAt: new Date() })
      .where(eq(tasksTable.id, req.params.id))
      .returning();
    if (!task) {
      res.status(404).json({ message: "Công việc không tồn tại" });
      return;
    }
    res.json(await enrichTask(task));
  } catch (err) {
    req.log.error({ err }, "Update task error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    await db.delete(tasksTable).where(eq(tasksTable.id, req.params.id));
    res.json({ message: "Đã xóa công việc" });
  } catch (err) {
    req.log.error({ err }, "Delete task error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

export default router;
