import React from "react";
import { Redirect } from "react-router-dom";

/**
 * O Financeiro antigo.
 *
 * Era uma tela só com quatro abas; virou cinco módulos com rota própria, cada
 * um no menu lateral. Este arquivo continua existindo porque `/finance` está
 * em links antigos e na barra de endereços de quem já usava o sistema.
 *
 * Cai em Contas a receber, que era a primeira aba e é o que quase todo mundo
 * vem ver — não em Métricas, que depende de uma permissão mais alta e mandaria
 * boa parte das pessoas para uma tela que elas não podem abrir.
 */
const Finance = () => <Redirect to="/finance/receber" />;

export default Finance;
