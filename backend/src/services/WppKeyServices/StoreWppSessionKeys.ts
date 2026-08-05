import { BufferJSON } from "whaileys";

import WppKey from "../../models/WppKey";
import { setInRedis, getRedisClient } from "../../libs/redisStore";
import { logger } from "../../utils/logger";

interface StoreKeyRequest {
  connectionId: number;
  deviceId: number;
  type: string;
  id: string;
  value: any;
}

// Chaves de altíssima rotatividade: quando há Redis, ficam nele para poupar
// escrita no banco. Sem Redis configurado caem na tabela junto com as demais —
// mais lento, mas correto. Descartá-las impediria qualquer decriptação.
const REDIS_KEY_TYPES = ["session", "sender-keys", "sender-key-memory"];

const StoreWppSessionKeys = async ({
  connectionId,
  deviceId,
  type,
  id,
  value
}: StoreKeyRequest): Promise<void> => {
  const valueJson = JSON.stringify(value, BufferJSON.replacer);

  if (REDIS_KEY_TYPES.includes(type) && getRedisClient()) {
    const redisKey = `wpp:${connectionId}:${deviceId}:${type}:${id}`;
    await setInRedis(redisKey, valueJson);

    return;
  }

  try {
    await WppKey.upsert({
      connectionId,
      type,
      keyId: id,
      value: valueJson
    });
  } catch (err) {
    logger.error({
      info: "Error storing key in database",
      connectionId,
      type,
      keyId: id,
      err
    });
  }
};

export default StoreWppSessionKeys;
