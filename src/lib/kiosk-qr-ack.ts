type KioskQrScanAck = {
  kioskId: string;
  nonce: string;
  exp: number;
  username: string;
  employeeName: string;
  employeeCode: string;
  punchType: string;
  punchTime: string;
  acknowledgedAt: number;
};

declare global {
  var __jumboKioskQrAckStore: Map<string, KioskQrScanAck> | undefined;
}

const getStore = () => {
  if (!globalThis.__jumboKioskQrAckStore) {
    globalThis.__jumboKioskQrAckStore = new Map<string, KioskQrScanAck>();
  }

  return globalThis.__jumboKioskQrAckStore;
};

const getChallengeKey = (input: {
  kioskId: string;
  nonce: string;
  exp: number;
}) => `${input.kioskId}:${input.nonce}:${input.exp}`;

const cleanupExpiredAcks = (store: Map<string, KioskQrScanAck>) => {
  const now = Date.now();

  for (const [key, value] of store.entries()) {
    if (value.exp < now - 60_000) {
      store.delete(key);
    }
  }
};

export const storeKioskQrScanAck = (ack: KioskQrScanAck) => {
  const store = getStore();
  cleanupExpiredAcks(store);
  store.set(
    getChallengeKey({
      kioskId: ack.kioskId,
      nonce: ack.nonce,
      exp: ack.exp,
    }),
    ack,
  );
};

export const consumeKioskQrScanAck = (input: {
  kioskId: string;
  nonce: string;
  exp: number;
}) => {
  const store = getStore();
  cleanupExpiredAcks(store);
  const key = getChallengeKey(input);
  const ack = store.get(key) ?? null;

  if (ack) {
    store.delete(key);
  }

  return ack;
};

export type { KioskQrScanAck };
