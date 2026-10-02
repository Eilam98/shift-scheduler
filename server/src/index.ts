import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import departmentRoutes from "./routes/departments";
import scheduleRoutes from "./routes/schedules";
import shiftRoutes from "./routes/shifts";
import slotRoutes from "./routes/slots";
import settingsRoutes from "./routes/settings";
import notificationRoutes from "./routes/notifications";
import availabilityRoutes from "./routes/availability";
import stationRoutes from "./routes/station";
import stationsRoutes from "./routes/stations";
import attendanceRoutes from "./routes/attendance";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/slots", slotRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/station", stationRoutes); // the time clock device (station key, no login)
app.use("/api/stations", stationsRoutes); // managing devices (restaurant manager)
app.use("/api/attendance", attendanceRoutes);

// Express 5 forwards errors thrown in async handlers here. Log the details
// server-side and return a generic JSON 500 instead of Express's HTML page.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
