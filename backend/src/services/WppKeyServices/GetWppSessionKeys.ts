import { BufferJSON } from "whaileys";

import WppKey from "../../models/WppKey";
import { getFromRedis, getRedisClient } from "../../libs/redisStore";
import { logger } from "../../utils/logger";

interface GetKeysRequest {
  connectionId: number;
  deviceId: number;
  type: string;
  ids: string[];
}

// Precisa espelhar a lista de StoreWppSessionKeys: ler de um lugar diferente
// de onde foi gravado devolveria vazio e quebraria a decriptação.
const REDIS_KEY_TYPES = ["session", "sender-keys", "sender-key-memory"];

const GetWppSessionKeys = async ({
  connectionId,
  deviceId,
  type,
  ids
}: GetKeysRequest): Promise<any> => {
  const data: any = {};

  if (REDIS_KEY_TYPES.includes(type) && getRedisClient()) {
    await Promise.all(
      ids.map(async id => {
        const key = `wpp:${connectionId}:${deviceId}:${type}:${id}`;
        const stored = await getFromRedis(key);

        if (stored) {
          data[id] = JSON.parse(stored, BufferJSON.reviver);
        }
      })
    );

    return data;
  }

  try {
    await Promise.all(
      ids.map(async id => {
        const keyRecord = await WppKey.findOne({
          where: {
            connectionId,
            type,
            keyId: id
          }
        });

        if (keyRecord) {
          data[id] = JSON.parse(keyRecord.value, BufferJSON.reviver);
        }
      })
    );
  } catch (err) {
    logger.error({
      info: "Error getting keys from database",
      connectionId,
      type,
      err
    });
  }

  return data;
};

export default GetWppSessionKeys;
