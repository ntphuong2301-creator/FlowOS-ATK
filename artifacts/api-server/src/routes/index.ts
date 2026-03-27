import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import xacThucRouter from "./xac-thuc.js";
import usersRouter from "./users.js";
import projectsRouter from "./projects.js";
import tasksRouter from "./tasks.js";
import flowsRouter from "./flows.js";
import aiRouter from "./ai.js";
import notificationsRouter from "./notifications.js";
import dashboardRouter from "./dashboard.js";
import canTroRouter from "./can-tro.js";
import nguoiDungRouter from "./nguoi-dung.js";
import duAnRouter from "./du-an.js";
import congViecRouter from "./cong-viec.js";
import dongChayRouter from "./dong-chay.js";
import banDoNutChanRouter from "./ban-do-nut-chan.js";
import sanPhamRouter from "./san-pham.js";
import buocRouter from "./buoc.js";
import thanhVienRouter from "./thanh-vien.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/xac-thuc", xacThucRouter);
router.use("/users", usersRouter);
router.use("/projects", projectsRouter);
router.use("/tasks", tasksRouter);
router.use("/flows", flowsRouter);
router.use("/ai", aiRouter);
router.use("/notifications", notificationsRouter);
router.use("/dashboard", dashboardRouter);

// Các route Prisma mới (FlowOS ATK)
router.use("/can-tro", canTroRouter);
router.use("/nguoi-dung", nguoiDungRouter);
router.use("/du-an", duAnRouter);
router.use("/cong-viec", congViecRouter);
router.use("/dong-chay", dongChayRouter);
router.use("/ban-do-nut-chan", banDoNutChanRouter);
router.use("/san-pham", sanPhamRouter);
router.use("/buoc", buocRouter);
router.use("/thanh-vien", thanhVienRouter);

export default router;
