import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { signToken, requireAuth, type AuthenticatedRequest } from "../lib/auth.js";

const router: IRouter = Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ message: "Email đã được sử dụng" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({ name, email, passwordHash }).returning();

    const token = signToken({ userId: user.id, email: user.email });
    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role, createdAt: user.createdAt },
    });
  } catch (err) {
    req.log.error({ err }, "Register error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role, createdAt: user.createdAt },
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) {
      res.status(404).json({ message: "Người dùng không tồn tại" });
      return;
    }
    res.json({ id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role, createdAt: user.createdAt });
  } catch (err) {
    req.log.error({ err }, "Get me error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.post("/logout", (_req, res) => {
  res.json({ message: "Đăng xuất thành công" });
});

export default router;
