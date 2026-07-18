import faker from "faker";
import AppError from "../../../errors/AppError";
import CreateUserService from "../../../services/UserServices/CreateUserService";
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

  it("should be able to create a new user", async () => {
    const user = await CreateUserService({
      name: faker.name.findName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
      companyId
    });

    expect(user).toHaveProperty("id");
  });

  it("should not be able to create a user with duplicated email", async () => {
    await CreateUserService({
      name: faker.name.findName(),
      email: "teste@sameemail.com",
      password: faker.internet.password(),
      companyId
    });

    try {
      await CreateUserService({
        name: faker.name.findName(),
        email: "teste@sameemail.com",
        password: faker.internet.password(),
        companyId
      });
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
    }
  });
});
