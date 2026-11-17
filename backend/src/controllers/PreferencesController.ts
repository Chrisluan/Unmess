import { Request, Response } from "express";
import * as Yup from "yup";

import AppError from "../errors/AppError";
import User from "../models/User";

/**
 * As preferências de tela de quem está pedindo.
 *
 * Este controller nunca recebe um id de usuário: a pessoa lê e grava as
 * próprias preferências e nada além disso. Foi de propósito — a alternativa
 * seria passar por `PUT /users/:id`, que exige `users:edit`, e aí favoritar um
 * módulo no menu viraria privilégio de administrador.
 */

/**
 * O tamanho da lista de favoritos é limitado porque o campo é gravado sem
 * nenhuma outra conferência de conteúdo: sem um teto, um cliente qualquer
 * poderia usar a coluna como depósito. Vinte é muito mais do que cabe na
 * barra lateral.
 */
const MAX_FAVORITOS = 20;

/**
 * As preferências que existem, e só elas.
 *
 * A gravação mesclava o corpo inteiro no campo, o que transformava a coluna
 * num depósito: qualquer cliente autenticado podia guardar ali o que quisesse,
 * com o tamanho que quisesse. Chave que não está nesta lista é descartada em
 * silêncio — preferência nova entra aqui junto da tela que a usa.
 */
const CONHECIDAS = ["favoritos"] as const;

const esquema = Yup.object().shape({
  favoritos: Yup.array()
    .of(Yup.string().trim().max(60).required())
    .max(MAX_FAVORITOS)
});

/**
 * Nunca lança: preferência corrompida no banco não pode impedir a pessoa de
 * usar o sistema. O pior caso é ela abrir o menu sem favoritos e favoritar de
 * novo, o que reescreve o campo com um JSON válido.
 */
const lerPreferencias = (bruto: string | null): Record<string, unknown> => {
  if (!bruto) return {};
  try {
    const valor = JSON.parse(bruto);
    return valor && typeof valor === "object" && !Array.isArray(valor)
      ? valor
      : {};
  } catch {
    return {};
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const user = await User.findByPk(Number(req.user.id), {
    attributes: ["id", "preferences"]
  });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  return res.status(200).json(lerPreferencias(user.preferences));
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const user = await User.findByPk(Number(req.user.id));

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  try {
    await esquema.validate(req.body);
  } catch (err: any) {
    throw new AppError(err.message, 400);
  }

  /**
   * Mescla em vez de substituir: o corpo traz só o que mudou. Uma tela que
   * grave `{ favoritos }` não pode apagar sem querer uma preferência que
   * outra tela guardou — que é exatamente o que "substituir o objeto
   * inteiro" faz quando duas telas escrevem no mesmo campo.
   */
  const novas = lerPreferencias(user.preferences);

  CONHECIDAS.forEach(chave => {
    if (req.body[chave] !== undefined) {
      novas[chave] = req.body[chave];
    }
  });

  await user.update({ preferences: JSON.stringify(novas) });

  return res.status(200).json(novas);
};
