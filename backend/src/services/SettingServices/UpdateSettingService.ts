import Setting from "../../models/Setting";

interface Request {
  key: string;
  value: string;
  companyId: number;
}

const UpdateSettingService = async ({
  key,
  value,
  companyId
}: Request): Promise<Setting | undefined> => {
  const [setting] = await Setting.findOrCreate({
    where: { key, companyId },
    defaults: { key, value, companyId }
  });

  await setting.update({ value });

  return setting;
};

export default UpdateSettingService;
