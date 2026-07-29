import Customer from "../../models/Customer";
import AppError from "../../errors/AppError";

const ShowCustomerService = async (
  id: string | number,
  companyId: number
): Promise<Customer> => {
  const customer = await Customer.findOne({
    where: { id, companyId },
    include: ["contact", "responsibleUser"]
  });

  if (!customer) {
    throw new AppError("ERR_NO_CUSTOMER_FOUND", 404);
  }

  return customer;
};

export default ShowCustomerService;
