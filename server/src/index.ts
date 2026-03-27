import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import xacThucRouter from "./routes/xac-thuc.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.json({ trangThai: "hoat-dong" });
});

app.use("/xac-thuc", xacThucRouter);

app.listen(PORT, () => {
  console.log(`Server FlowOS đang chạy tại cổng ${PORT}`);
});

export default app;
