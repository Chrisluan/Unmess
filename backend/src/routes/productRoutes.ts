import { Router } from "express";

import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as ProductController from "../controllers/ProductController";

const productRoutes = Router();

// Ver o catálogo usa a permissão de ver o CRM: quem monta um orçamento precisa
// escolher produtos, e exigir uma permissão à parte só para isso travaria o
// trabalho de quem já pode orçar.
productRoutes.get("/products",            isAuth, requiresCompany, hasPermission("crm:view"),   ProductController.index);
productRoutes.get("/products/categories", isAuth, requiresCompany, hasPermission("crm:view"),   ProductController.categories);

// Mexer no catálogo é outra coisa: preço errado aqui contamina todo orçamento
// feito daqui para a frente.
productRoutes.post("/products",              isAuth, requiresCompany, hasPermission("products:manage"), ProductController.store);
productRoutes.put("/products/:productId",    isAuth, requiresCompany, hasPermission("products:manage"), ProductController.update);
productRoutes.delete("/products/:productId", isAuth, requiresCompany, hasPermission("products:manage"), ProductController.remove);

export default productRoutes;
