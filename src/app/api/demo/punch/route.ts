import { NextRequest, NextResponse } from "next/server";

type PunchType = "TIME_IN" | "TIME_OUT";

function nextPunch(last?: PunchType): PunchType {
  if (!last) return "TIME_IN";
  return last === "TIME_IN" ? "TIME_OUT" : "TIME_IN";
}

function todayKey(d = new Date()) {
  // YYYY-MM-DD in server time
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type LastPunch = {
  employeeId: string;
  employeeName: string;
  kioskId: string;
  punch: PunchType;
  at: number;
  historyCount: number;
};

// ✅ In-memory punch state (NO DB). Resets on restart / redeploy.
const globalAny = globalThis as any;
const punchState: Map<
  string,
  { date: string; last?: PunchType; history: { type: PunchType; at: number }[] }
> = globalAny.__PUNCH_STATE__ ?? new Map();
globalAny.__PUNCH_STATE__ = punchState;
const lastByKiosk: Map<string, LastPunch> =
  globalAny.__LAST_PUNCH_BY_KIOSK__ ?? new Map();
globalAny.__LAST_PUNCH_BY_KIOSK__ = lastByKiosk;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kioskId = String(searchParams.get("kioskId") ?? "");

  if (!kioskId) {
    return NextResponse.json(
      { ok: false, error: "Missing kioskId" },
      { status: 400 }
    );
  }

  const last = lastByKiosk.get(kioskId);
  if (!last) {
    return NextResponse.json(
      { ok: false, error: "No punches yet" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, ...last });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const employeeId = String(body.employeeId ?? "");
    const employeeName = String(body.employeeName ?? "");
    const kioskId = String(body.kioskId ?? "");
    const nonce = String(body.nonce ?? "");
    const exp = Number(body.exp ?? 0); // epoch ms from kiosk QR
    const deviceId = String(body.deviceId ?? "");

    if (!employeeId || !employeeName || !kioskId || !nonce || !deviceId) {
      return NextResponse.json(
        { ok: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    // Expiry check: reject if the kiosk challenge is already expired
    if (!exp || Date.now() > exp) {
      return NextResponse.json(
        { ok: false, error: "Kiosk QR expired. Please rescan." },
        { status: 400 }
      );
    }

    // Determine next punch server-side (authoritative)
    const key = employeeId;
    const today = todayKey();

    const existing = punchState.get(key);
    const state =
      existing && existing.date === today
        ? existing
        : { date: today, last: undefined, history: [] as any[] };

    const punch = nextPunch(state.last);
    const at = Date.now();

    state.last = punch;
    state.history.push({ type: punch, at });
    punchState.set(key, state);
    const historyCount = state.history.length;
    lastByKiosk.set(kioskId, {
      employeeId,
      employeeName,
      kioskId,
      punch,
      at,
      historyCount,
    });

    return NextResponse.json({
      ok: true,
      employeeId,
      employeeName,
      kioskId,
      punch,
      at,
      historyCount,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
