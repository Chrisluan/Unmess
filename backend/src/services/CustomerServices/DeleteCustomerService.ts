import Customer from "../../models/Customer";
import AppError from "../../errors/AppError";

const DeleteCustomerService = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const customer = await Customer.findOne({
    where: { id, companyId }
  });

  if (!customer) {
    throw new AppError("ERR_NO_CUSTOMER_FOUND", 404);
  }

  await customer.destroy();
};

export default DeleteCustomerService;
