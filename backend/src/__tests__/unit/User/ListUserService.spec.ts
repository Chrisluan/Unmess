import faker from "faker";
import User from "../../../models/User";
import Company from "../../../models/Company";
import CreateUserService from "../../../services/UserServices/CreateUserService";
import ListUsersService from "../../../services/UserServices/ListUsersService";
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

  it("should be able to list users", async () => {
    await CreateUserService({
      name: faker.name.findName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
      companyId
    });

    const response = await ListUsersService({
      pageNumber: 1,
      companyId
    });

    expect(response).toHaveProperty("users");
    expect(response.users[0]).toBeInstanceOf(User);
  });
});
