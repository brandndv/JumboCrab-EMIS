import "server-only";

import { EventEmitter } from "events";
import { Client, Pool } from "pg";
import type { PublishedNotificationEvent } from "./types";

const CHANNEL_NAME = "jumbocrab_notifications";
const EMIT_EVENT_NAME = "notification";

type GlobalNotificationBus = typeof globalThis & {
  __notificationEmitter__?: EventEmitter;
  __notificationPool__?: Pool;
  __notificationListenerClient__?: Client | null;
  __notificationListenerReady__?: Promise<void> | null;
};

const globalBus = globalThis as GlobalNotificationBus;

const emitter =
  globalBus.__notificationEmitter__ ??
  (globalBus.__notificationEmitter__ = new EventEmitter());

const pool =
  globalBus.__notificationPool__ ??
  (globalBus.__notificationPool__ = new Pool({
    connectionString: process.env.DATABASE_URL,
  }));

function emitEvent(payload: PublishedNotificationEvent) {
  emitter.emit(EMIT_EVENT_NAME, payload);
}

async function connectListener() {
  if (globalBus.__notificationListenerReady__) {
    return globalBus.__notificationListenerReady__;
  }

  globalBus.__notificationListenerReady__ = (async () => {
    try {
      const client = new Client({
        connectionString: process.env.DATABASE_URL,
      });
      await client.connect();
      await client.query(`LISTEN ${CHANNEL_NAME}`);
      client.on("notification", (message) => {
        if (!message.payload) return;
        try {
          emitEvent(JSON.parse(message.payload) as PublishedNotificationEvent);
        } catch (error) {
          console.error("Failed to parse notification payload:", error);
        }
      });
      client.on("error", (error) => {
        console.error("Notification listener error:", error);
        globalBus.__notificationListenerClient__ = null;
        globalBus.__notificationListenerReady__ = null;
      });
      client.on("end", () => {
        globalBus.__notificationListenerClient__ = null;
        globalBus.__notificationListenerReady__ = null;
      });
      globalBus.__notificationListenerClient__ = client;
    } catch (error) {
      console.error("Failed to start notification listener:", error);
      globalBus.__notificationListenerClient__ = null;
      globalBus.__notificationListenerReady__ = null;
    }
  })();

  return globalBus.__notificationListenerReady__;
}

export async function publishNotificationEvent(
  payload: PublishedNotificationEvent,
) {
  // Emit locally first so the current app instance pushes live updates
  // immediately; pg_notify still covers other server instances.
  emitEvent(payload);

  try {
    await pool.query("SELECT pg_notify($1, $2)", [
      CHANNEL_NAME,
      JSON.stringify(payload),
    ]);
  } catch (error) {
    console.error("Failed to publish notification event:", error);
  }
}

export function subscribeToNotificationEvents(
  listener: (payload: PublishedNotificationEvent) => void,
) {
  void connectListener();
  emitter.on(EMIT_EVENT_NAME, listener);

  return () => {
    emitter.off(EMIT_EVENT_NAME, listener);
  };
}
