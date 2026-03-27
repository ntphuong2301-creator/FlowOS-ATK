import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { aiMessagesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth.js";

const router: IRouter = Router();
router.use(requireAuth);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

router.post("/chat", async (req: AuthenticatedRequest, res) => {
  try {
    const { message, context } = req.body;
    if (!message) {
      res.status(400).json({ message: "Tin nhắn là bắt buộc" });
      return;
    }

    await db.insert(aiMessagesTable).values({
      userId: req.userId!,
      message,
      role: "user",
      context,
    });

    let assistantMessage = "";
    try {
      const systemPrompt = `Bạn là trợ lý AI thông minh của FlowOS - ứng dụng quản lý dự án. 
      Hãy trả lời bằng tiếng Việt, ngắn gọn và hữu ích.
      ${context ? `Ngữ cảnh hiện tại: ${context}` : ""}`;

      const response = await anthropic.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: message }],
      });

      assistantMessage = response.content[0].type === "text" ? response.content[0].text : "Xin lỗi, tôi không thể xử lý yêu cầu này.";
    } catch {
      assistantMessage = "Trợ lý AI hiện không khả dụng. Vui lòng thử lại sau.";
    }

    const [saved] = await db.insert(aiMessagesTable).values({
      userId: req.userId!,
      message: assistantMessage,
      role: "assistant",
    }).returning();

    res.json({ id: saved.id, message: assistantMessage, role: "assistant", createdAt: saved.createdAt });
  } catch (err) {
    req.log.error({ err }, "AI chat error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

router.get("/history", async (req: AuthenticatedRequest, res) => {
  try {
    const messages = await db.select().from(aiMessagesTable)
      .where(eq(aiMessagesTable.userId, req.userId!))
      .orderBy(aiMessagesTable.createdAt);
    res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Get AI history error");
    res.status(500).json({ message: "Lỗi server" });
  }
});

export default router;
