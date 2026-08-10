import Company from "../../models/Company";

export interface Branding {
  name: string | null;
  logo: string | null;
}

/**
 * Nome e logo da empresa para exibir na interface.
 *
 * Devolve os dois campos e nada mais: a barra lateral é carregada por todo
 * atendente logado, e o restante do cadastro (documento, plano, vencimento)
 * não tem por que trafegar para quem só precisa desenhar o cabeçalho.
 */
const ShowBrandingService = async (
  companyId: number
): Promise<Branding> => {
  const company = await Company.findByPk(companyId, {
    attributes: ["name", "logo"]
  });

  if (!company) return { name: null, logo: null };

  return { name: company.name, logo: company.logo };
};

export default ShowBrandingService;
