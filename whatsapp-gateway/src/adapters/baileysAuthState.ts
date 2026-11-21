import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataSet,
  type SignalDataTypeMap
} from "baileys";
import type { SecretStore } from "../storage/secretStore.ts";

const CREDS_KEY = "creds";

export function useEncryptedAuthState(store: SecretStore, sessionId: string): {
  state: AuthenticationState;
  saveCreds: () => void;
} {
  const read = <T>(name: string): T | undefined => {
    const raw = store.read(sessionId, name);
    return raw === undefined ? undefined : (JSON.parse(raw, BufferJSON.reviver) as T);
  };

  const creds: AuthenticationCreds = read<AuthenticationCreds>(CREDS_KEY) ?? initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const result: { [id: string]: SignalDataTypeMap[T] } = {};
          for (const id of ids) {
            let value = read<SignalDataTypeMap[T]>(`${type}-${id}`);
            if (value !== undefined && type === "app-state-sync-key") {
              value = proto.Message.AppStateSyncKeyData.fromObject(value as object) as unknown as SignalDataTypeMap[T];
            }
            if (value !== undefined) {
              result[id] = value;
            }
          }
          return result;
        },
        set: async (data: SignalDataSet) => {
          store.transaction(() => {
            for (const [type, entries] of Object.entries(data)) {
              for (const [id, value] of Object.entries(entries ?? {})) {
                const name = `${type}-${id}`;
                if (value) {
                  store.write(sessionId, name, JSON.stringify(value, BufferJSON.replacer));
                } else {
                  store.remove(sessionId, name);
                }
              }
            }
          });
        }
      }
    },
    saveCreds: () => store.write(sessionId, CREDS_KEY, JSON.stringify(creds, BufferJSON.replacer))
  };
}
