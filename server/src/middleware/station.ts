import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { hashStationToken } from "../lib/stations";

/**
 * For time clock routes: the device must send its station key in
 * X-Station-Token. Puts the StationDevice row in res.locals.station.
 * Revoked or unknown keys get 401 STATION_INVALID.
 */
export async function authenticateStation(req: Request, res: Response, next: NextFunction) {
  const token = req.header("X-Station-Token");
  const station = token
    ? await prisma.stationDevice.findUnique({ where: { tokenHash: hashStationToken(token) } })
    : null;
  if (!station || station.revokedAt) {
    return res.status(401).json({ error: "This device is not an active time clock", code: "STATION_INVALID" });
  }
  res.locals.station = station;
  next();
}
