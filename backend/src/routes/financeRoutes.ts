import express from "express";
import isAuth from "../middleware/isAuth";
import requiresCompany from "../middleware/requiresCompany";
import hasPermission from "../middleware/hasPermission";
import * as FinanceController from "../controllers/FinanceController";

const financeRoutes = express.Router();

/**
 * Módulo financeiro.
 *
 * A separação de permissões segue o risco: ver quanto a empresa tem a receber
 * é uma coisa, dar baixa em dinheiro é outra bem diferente, e configurar as
 * contas da empresa é uma terceira. Quem atende no balcão costuma precisar só
 * da primeira.
 */

// ── Contas a receber ────────────────────────────────────────────────────────
financeRoutes.get("/finance/receivables",  isAuth, requiresCompany, hasPermission("finance:view"),    FinanceController.listarReceber);
// Rota fixa antes da paramétrica, senão "pendentes" cairia em :receivableId.
financeRoutes.get("/finance/pendentes",    isAuth, requiresCompany, hasPermission("finance:view"),    FinanceController.pendentes);
financeRoutes.get("/finance/propor/:dealId", isAuth, requiresCompany, hasPermission("finance:bill"),  FinanceController.propor);
financeRoutes.post("/finance/receivables", isAuth, requiresCompany, hasPermission("finance:bill"),    FinanceController.gerar);
financeRoutes.post("/finance/receivables/:receivableId/receber", isAuth, requiresCompany, hasPermission("finance:settle"), FinanceController.receber);
financeRoutes.put("/finance/receivables/:receivableId/cancelar", isAuth, requiresCompany, hasPermission("finance:bill"),   FinanceController.cancelarCobranca);
financeRoutes.delete("/finance/entries/:entryId", isAuth, requiresCompany, hasPermission("finance:settle"), FinanceController.estornar);

// ── Contas a pagar ──────────────────────────────────────────────────────────
financeRoutes.get("/finance/payables",     isAuth, requiresCompany, hasPermission("finance:view"),   FinanceController.listarPagar);
financeRoutes.post("/finance/payables",    isAuth, requiresCompany, hasPermission("finance:bill"),   FinanceController.criarPagar);
financeRoutes.post("/finance/payables/:payableId/pagar",    isAuth, requiresCompany, hasPermission("finance:settle"), FinanceController.pagarConta);
financeRoutes.put("/finance/payables/:payableId/cancelar",  isAuth, requiresCompany, hasPermission("finance:bill"),   FinanceController.cancelarPagar);

financeRoutes.get("/finance/suppliers",       isAuth, requiresCompany, hasPermission("finance:view"),   FinanceController.listarFornecedores);
financeRoutes.post("/finance/suppliers",      isAuth, requiresCompany, hasPermission("finance:manage"), FinanceController.salvarFornecedor);
financeRoutes.delete("/finance/suppliers/:id", isAuth, requiresCompany, hasPermission("finance:manage"), FinanceController.removerFornecedor);

// ── Caixa ───────────────────────────────────────────────────────────────────
financeRoutes.get("/finance/fluxo", isAuth, requiresCompany, hasPermission("finance:cashflow"), FinanceController.fluxoDeCaixa);

// ── Cadastros de apoio ──────────────────────────────────────────────────────
// A leitura exige só finance:view: os seletores da tela de cobrança dependem
// dela, e quem lança precisa escolher conta e categoria sem poder criá-las.
financeRoutes.get("/finance/cadastros", isAuth, requiresCompany, hasPermission("finance:view"), FinanceController.listarCadastros);

financeRoutes.post("/finance/payment-terms",       isAuth, requiresCompany, hasPermission("finance:manage"), FinanceController.salvarCondicao);
financeRoutes.delete("/finance/payment-terms/:id", isAuth, requiresCompany, hasPermission("finance:manage"), FinanceController.removerCondicao);
financeRoutes.post("/finance/accounts",            isAuth, requiresCompany, hasPermission("finance:manage"), FinanceController.salvarConta);
financeRoutes.delete("/finance/accounts/:id",      isAuth, requiresCompany, hasPermission("finance:manage"), FinanceController.removerConta);
financeRoutes.post("/finance/categories",          isAuth, requiresCompany, hasPermission("finance:manage"), FinanceController.salvarCategoria);
financeRoutes.delete("/finance/categories/:id",    isAuth, requiresCompany, hasPermission("finance:manage"), FinanceController.removerCategoria);

export default financeRoutes;
