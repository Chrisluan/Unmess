import faker from "faker";
import AppError from "../../../errors/AppError";
import CreateUserService from "../../../services/UserServices/CreateUserService";
import DeleteUserService from "../../../services/UserServices/DeleteUserService";
import Company from "../../../models/Company";
import { disconnect, truncate } from "../../utils/database";

describe("User", () => {
  let companyId: number;

  beforeEach(async () => {
    await truncate();
    const company = await Company.create({ name: faker.company.companyName() });
    companyId = company.id;
  });

  afterEach(async () => {
    await truncate();
  });

  afterAll(async () => {
    await disconnect();
  });

  it("should be delete a existing user", async () => {
    const { id } = await CreateUserService({
      name: faker.name.findName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
      companyId
    });

    expect(DeleteUserService(id, companyId)).resolves.not.toThrow();
  });

  it("to throw an error if tries to delete a non existing user", async () => {
    expect(
      DeleteUserService(faker.random.number(), companyId)
    ).rejects.toBeInstanceOf(AppError);
  });
});
