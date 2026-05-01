import "server-only";

import { EventEmitter } from "events";
import { Client, Pool } from "pg";
import type { AttendanceLiveEvent } from "./types";

const CHANNEL_NAME = "jumbocrab_attendance_live";
const EMIT_EVENT_NAME = "attendance-live";

type GlobalAttendanceBus = typeof globalThis & {
  __attendanceLiveEmitter__?: EventEmitter;
  __attendanceLivePool__?: Pool;
  __attendanceLiveListenerClient__?: Client | null;
  __attendanceLiveListenerReady__?: Promise<void> | null;
};

const globalBus = globalThis as GlobalAttendanceBus;

const emitter =
  globalBus.__attendanceLiveEmitter__ ??
  (globalBus.__attendanceLiveEmitter__ = new EventEmitter());

const pool =
  globalBus.__attendanceLivePool__ ??
  (globalBus.__attendanceLivePool__ = new Pool({
    connectionString: process.env.DATABASE_URL,
  }));

function emitEvent(payload: AttendanceLiveEvent) {
  emitter.emit(EMIT_EVENT_NAME, payload);
}

async function connectListener() {
  if (globalBus.__attendanceLiveListenerReady__) {
    return globalBus.__attendanceLiveListenerReady__;
  }

  globalBus.__attendanceLiveListenerReady__ = (async () => {
    try {
      const client = new Client({
        connectionString: process.env.DATABASE_URL,
      });
      await client.connect();
      await client.query(`LISTEN ${CHANNEL_NAME}`);
      client.on("notification", (message) => {
        if (!message.payload) return;
        try {
          emitEvent(JSON.parse(message.payload) as AttendanceLiveEvent);
        } catch (error) {
          console.error("Failed to parse attendance live payload:", error);
        }
      });
      client.on("error", (error) => {
        console.error("Attendance live listener error:", error);
        globalBus.__attendanceLiveListenerClient__ = null;
        globalBus.__attendanceLiveListenerReady__ = null;
      });
      client.on("end", () => {
        globalBus.__attendanceLiveListenerClient__ = null;
        globalBus.__attendanceLiveListenerReady__ = null;
      });
      globalBus.__attendanceLiveListenerClient__ = client;
    } catch (error) {
      console.error("Failed to start attendance live listener:", error);
      globalBus.__attendanceLiveListenerClient__ = null;
      globalBus.__attendanceLiveListenerReady__ = null;
    }
  })();

  return globalBus.__attendanceLiveListenerReady__;
}

export async function publishAttendanceLiveEvent(payload: AttendanceLiveEvent) {
  emitEvent(payload);

  try {
    await pool.query("SELECT pg_notify($1, $2)", [
      CHANNEL_NAME,
      JSON.stringify(payload),
    ]);
  } catch (error) {
    console.error("Failed to publish attendance live event:", error);
  }
}

export function subscribeToAttendanceLiveEvents(
  listener: (payload: AttendanceLiveEvent) => void,
) {
  void connectListener();
  emitter.on(EMIT_EVENT_NAME, listener);

  return () => {
    emitter.off(EMIT_EVENT_NAME, listener);
  };
}
