import { Router } from "express";

import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as ProductController from "../controllers/ProductController";
import * as CatalogoDePrecoController from "../controllers/CatalogoDePrecoController";

const productRoutes = Router();

// Ver o catálogo usa a permissão de ver o CRM: quem monta um orçamento precisa
// escolher produtos, e exigir uma permissão à parte só para isso travaria o
// trabalho de quem já pode orçar.
productRoutes.get("/products",            isAuth, requiresCompany, hasPermission("products:view"),   ProductController.index);
productRoutes.get("/products/categories", isAuth, requiresCompany, hasPermission("products:view"),   ProductController.categories);

// Mexer no catálogo é outra coisa: preço errado aqui contamina todo orçamento
// feito daqui para a frente.
productRoutes.post("/products",              isAuth, requiresCompany, hasPermission("products:manage"), ProductController.store);
productRoutes.put("/products/:productId",    isAuth, requiresCompany, hasPermission("products:manage"), ProductController.update);
productRoutes.delete("/products/:productId", isAuth, requiresCompany, hasPermission("products:manage"), ProductController.remove);

// ── Insumos e acabamentos (formação do preço) ───────────────────────────────
// Insumo é só custo: listar pede ver custo. Acabamento tem preço e entra no
// orçamento, então quem consulta o catálogo vê a lista (sem o custo, se não
// puder vê-lo). Cadastrar os dois é mexer no preço: products:manage.
productRoutes.get("/insumos",                  isAuth, requiresCompany, hasPermission("products:viewCost"), CatalogoDePrecoController.listarInsumos);
productRoutes.post("/insumos",                 isAuth, requiresCompany, hasPermission("products:manage"),   CatalogoDePrecoController.salvarInsumo);
productRoutes.put("/insumos/:insumoId",        isAuth, requiresCompany, hasPermission("products:manage"),   CatalogoDePrecoController.salvarInsumo);
productRoutes.delete("/insumos/:insumoId",     isAuth, requiresCompany, hasPermission("products:manage"),   CatalogoDePrecoController.desativarInsumo);
productRoutes.get("/acabamentos",              isAuth, requiresCompany, hasPermission("products:view"),     CatalogoDePrecoController.listarAcabamentos);
productRoutes.post("/acabamentos",             isAuth, requiresCompany, hasPermission("products:manage"),   CatalogoDePrecoController.salvarAcabamento);
productRoutes.put("/acabamentos/:acabamentoId",    isAuth, requiresCompany, hasPermission("products:manage"), CatalogoDePrecoController.salvarAcabamento);
productRoutes.delete("/acabamentos/:acabamentoId", isAuth, requiresCompany, hasPermission("products:manage"), CatalogoDePrecoController.desativarAcabamento);

export default productRoutes;
