import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { flowsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth.js";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId } = req.query;
    const flows = projectId
      ? await db.select().from(flowsTable).where(eq(flowsTable.projectId, projectId as string)).orderBy(flowsTable.createdAt)
      : await db.select().from(flowsTable).orderBy(flowsTable.createdAt);
    res.json(flows);
  } catch (err) {
    req.log.error({ err }, "List flows error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, projectId, nodes, edges } = req.body;
    if (!name) {
      res.status(400).json({ message: "Tên flow là bắt buộc" });
      return;
    }
    const [flow] = await db.insert(flowsTable).values({
      name, description, projectId,
      ownerId: req.userId!,
      nodes: nodes || "[]",
      edges: edges || "[]",
    }).returning();
    res.status(201).json(flow);
  } catch (err) {
    req.log.error({ err }, "Create flow error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const [flow] = await db.select().from(flowsTable).where(eq(flowsTable.id, req.params.id)).limit(1);
    if (!flow) {
      res.status(404).json({ message: "Flow không tồn tại" });
      return;
    }
    res.json(flow);
  } catch (err) {
    req.log.error({ err }, "Get flow error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.put("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, nodes, edges } = req.body;
    const [flow] = await db.update(flowsTable)
      .set({ name, description, nodes, edges, updatedAt: new Date() })
      .where(eq(flowsTable.id, req.params.id))
      .returning();
    if (!flow) {
      res.status(404).json({ message: "Flow không tồn tại" });
      return;
    }
    res.json(flow);
  } catch (err) {
    req.log.error({ err }, "Update flow error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    await db.delete(flowsTable).where(eq(flowsTable.id, req.params.id));
    res.json({ message: "Đã xóa flow" });
  } catch (err) {
    req.log.error({ err }, "Delete flow error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

export default router;
