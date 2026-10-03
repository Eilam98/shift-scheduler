import "dotenv/config";
import fs from "fs";
import path from "path";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
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
import tetrisRoutes from "./routes/tetris";
import shiftReportRoutes from "./routes/shiftReports";
import payRateRoutes from "./routes/payRates";
import payrollRoutes from "./routes/payroll";
import pushRoutes from "./routes/push";

const app = express();
const PORT = process.env.PORT || 4000;
const production = process.env.NODE_ENV === "production";

// Behind Render's proxy: trust its X-Forwarded-For so rate limits see real client IPs.
app.set("trust proxy", 1);

// Security headers. The app and the API share one origin, so the content
// security policy only allows our own site ('unsafe-inline' styles: React style attributes).
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: production ? [] : null, // local http://localhost must stay http
      },
    },
  })
);
app.use(express.json());

// Slow down password guessing: 10 login attempts per 15 minutes per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts — try again in a few minutes", code: "TOO_MANY_ATTEMPTS" },
  skip: () => !production, // local test scripts log in a lot
});
app.use("/api/auth/login", loginLimiter);

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
app.use("/api/tetris", tetrisRoutes);
app.use("/api/shift-reports", shiftReportRoutes);
app.use("/api/pay-rates", payRateRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/push", pushRoutes);

// Unknown API routes: JSON 404 (not the app's index.html).
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// The built client (client/dist), when it exists: one server for app + API.
// Hashed assets are cached for a year; index.html and the service worker are
// always re-checked so a new deploy reaches everyone.
const clientDist = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders: (res, file) => {
        if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        else res.setHeader("Cache-Control", "no-cache");
      },
    })
  );
  // Any other GET is a page of the React app (e.g. /schedule/…): send index.html.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Express 5 forwards errors thrown in async handlers here. Log the details
// server-side and return a generic JSON 500 instead of Express's HTML page.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}${fs.existsSync(clientDist) ? " (serving client/dist)" : ""}`);
});
