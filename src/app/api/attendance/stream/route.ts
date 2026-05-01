import { getSession } from "@/lib/auth";
import { subscribeToAttendanceLiveEvents } from "@/lib/attendance-live/bus.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encodeSse(event: string, data: unknown, id?: string) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n${id ? `id: ${id}\n` : ""}\n`;
  return new TextEncoder().encode(payload);
}

export async function GET(request: Request) {
  const session = await getSession();

  if (!session.isLoggedIn || !session.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date")?.trim() || null;
  const employeeId = url.searchParams.get("employeeId")?.trim() || null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const cleanupHandlers: Array<() => void> = [];

      const close = () => {
        cleanupHandlers.splice(0).forEach((handler) => handler());
        try {
          controller.close();
        } catch {}
      };

      controller.enqueue(
        encodeSse("ready", {
          type: "ready",
          serverTime: new Date().toISOString(),
        }),
      );

      const unsubscribe = subscribeToAttendanceLiveEvents((payload) => {
        if (employeeId && payload.employeeId !== employeeId) {
          return;
        }

        if (date) {
          const payloadDate = payload.workDate.slice(0, 10);
          if (payloadDate !== date) {
            return;
          }
        }

        controller.enqueue(
          encodeSse(
            "attendance-update",
            {
              type: "attendance-update",
              ...payload,
            },
            payload.deletedPunchId ?? payload.punch?.id ?? payload.attendance?.id,
          ),
        );
      });
      cleanupHandlers.push(unsubscribe);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encodeSse("heartbeat", {
              type: "heartbeat",
              serverTime: new Date().toISOString(),
            }),
          );
        } catch {
          close();
        }
      }, 25_000);
      cleanupHandlers.push(() => clearInterval(heartbeat));

      const abortHandler = () => close();
      request.signal.addEventListener("abort", abortHandler);
      cleanupHandlers.push(() =>
        request.signal.removeEventListener("abort", abortHandler),
      );
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
