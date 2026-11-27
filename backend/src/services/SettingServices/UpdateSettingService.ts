import { Transaction } from "sequelize";

import Setting from "../../models/Setting";

interface Request {
  key: string;
  value: string;
  companyId: number;
  transaction?: Transaction;
}

const UpdateSettingService = async ({
  key,
  value,
  companyId,
  transaction
}: Request): Promise<Setting | undefined> => {
  const [setting] = await Setting.findOrCreate({
    where: { key, companyId },
    defaults: { key, value, companyId },
    transaction
  });

  await setting.update({ value }, { transaction });

  return setting;
};

export default UpdateSettingService;
