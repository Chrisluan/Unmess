import faker from "faker";
import AppError from "../../../errors/AppError";
import CreateUserService from "../../../services/UserServices/CreateUserService";
import UpdateUserService from "../../../services/UserServices/UpdateUserService";
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

  it("should be able to find a user", async () => {
    const newUser = await CreateUserService({
      name: faker.name.findName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
      companyId
    });

    const updatedUser = await UpdateUserService({
      userId: newUser.id,
      companyId,
      userData: {
        name: "New name",
        email: "newmail@email.com"
      }
    });

    expect(updatedUser).toHaveProperty("name", "New name");
    expect(updatedUser).toHaveProperty("email", "newmail@email.com");
  });

  it("should not be able to updated a inexisting user", async () => {
    const userId = faker.random.number();
    const userData = {
      name: faker.name.findName(),
      email: faker.internet.email()
    };

    expect(
      UpdateUserService({ userId, userData, companyId })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("should not be able to updated an user with invalid data", async () => {
    const newUser = await CreateUserService({
      name: faker.name.findName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
      companyId
    });

    const userId = newUser.id;
    const userData = {
      name: faker.name.findName(),
      email: "test.worgn.email"
    };

    expect(
      UpdateUserService({ userId, userData, companyId })
    ).rejects.toBeInstanceOf(AppError);
  });
});
