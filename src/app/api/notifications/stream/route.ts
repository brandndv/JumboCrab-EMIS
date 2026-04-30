import { getSession } from "@/lib/auth";
import { subscribeToNotificationEvents } from "@/lib/notifications/bus.server";
import {
  listNotificationsForUser,
  listNotificationsSince,
} from "@/lib/notifications";
import { normalizeRole } from "@/lib/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encodeSse(event: string, data: unknown, id?: string) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n${id ? `id: ${id}\n` : ""}\n`;
  return new TextEncoder().encode(payload);
}

export async function GET(request: Request) {
  const session = await getSession();
  const role = normalizeRole(session.role);

  if (!session.isLoggedIn || !session.userId || !role) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const afterCreatedAt = url.searchParams.get("afterCreatedAt");
  const afterId = url.searchParams.get("afterId");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const cleanupHandlers: Array<() => void> = [];

      const close = () => {
        cleanupHandlers.splice(0).forEach((handler) => handler());
        try {
          controller.close();
        } catch {}
      };

      const sendSnapshot = async () => {
        const [snapshot, missedItems] = await Promise.all([
          listNotificationsForUser({
            userId: session.userId!,
            role,
            filters: {
              limit: 10,
            },
          }),
          listNotificationsSince({
            userId: session.userId!,
            role,
            afterCreatedAt,
            afterId,
          }),
        ]);

        controller.enqueue(
          encodeSse(
            "snapshot",
            {
              type: "snapshot",
              unreadCount: snapshot.unreadCount,
              items: snapshot.items,
              missedItems,
              serverTime: new Date().toISOString(),
            },
            snapshot.items[0]?.id,
          ),
        );
      };

      try {
        await sendSnapshot();
      } catch (error) {
        console.error("Failed to send notification snapshot:", error);
        close();
        return;
      }

      const unsubscribe = subscribeToNotificationEvents(async (payload) => {
        if (payload.userId !== session.userId) {
          return;
        }

        controller.enqueue(
          encodeSse(
            "notification",
            {
              type: "notification",
              unreadCount: payload.unreadCount,
              item: payload.item,
              serverTime: payload.publishedAt,
            },
            payload.item.id,
          ),
        );
      });
      cleanupHandlers.push(unsubscribe);

      const heartbeat = setInterval(async () => {
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
