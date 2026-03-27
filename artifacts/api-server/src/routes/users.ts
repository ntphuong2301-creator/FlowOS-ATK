import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth.js";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const users = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      avatar: usersTable.avatar,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    }).from(usersTable).orderBy(usersTable.name);
    res.json(users);
  } catch (err) {
    req.log.error({ err }, "List users error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const [user] = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      avatar: usersTable.avatar,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.id, req.params.id)).limit(1);
    if (!user) {
      res.status(404).json({ message: "Người dùng không tồn tại" });
      return;
    }
    res.json(user);
  } catch (err) {
    req.log.error({ err }, "Get user error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

export default router;
