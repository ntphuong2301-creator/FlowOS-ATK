import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth.js";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const notifications = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, req.userId!))
      .orderBy(notificationsTable.createdAt);
    res.json(notifications);
  } catch (err) {
    req.log.error({ err }, "List notifications error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.put("/:id/read", async (req: AuthenticatedRequest, res) => {
  try {
    const [notification] = await db.update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, req.params.id), eq(notificationsTable.userId, req.userId!)))
      .returning();
    if (!notification) {
      res.status(404).json({ message: "Thông báo không tồn tại" });
      return;
    }
    res.json(notification);
  } catch (err) {
    req.log.error({ err }, "Mark notification read error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

export default router;
