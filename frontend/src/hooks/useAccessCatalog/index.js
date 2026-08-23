import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../services/api";

/**
 * O catálogo de permissões, buscado no servidor.
 *
 * O frontend tinha uma cópia própria em `constants/permissions.js`. Ela
 * divergiu em silêncio e ficou sem CRM, Financeiro, Produtos e Figurinhas —
 * quatro módulos inteiros que, por isso, não tinham como ser concedidos a
 * ninguém pela tela. A única saída era marcar a pessoa como administrador, e
 * era assim que quase todo mundo virava administrador.
 *
 * Agora só existe uma lista, e ela mora onde as permissões são conferidas.
 */
const useAccessCatalog = () => {
  const [modulos, setModulos] = useState({});
  const [niveis, setNiveis] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        const { data } = await api.get("/access/catalog");
        if (!ativo) return;
        setModulos(data.modules || {});
        setNiveis(data.levels || []);
        setModelos(data.templates || []);
      } catch (err) {
        if (ativo) setErro(err);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  /** Os módulos na ordem em que o catálogo os declara. */
  const listaDeModulos = useMemo(
    () =>
      Object.entries(modulos)
        .map(([chave, modulo]) => ({ chave, ...modulo }))
        .sort((a, b) => a.ordem - b.ordem),
    [modulos]
  );

  /** Índice de id da permissão → { modulo, acao }, para rótulos e buscas. */
  const indice = useMemo(() => {
    const mapa = new Map();
    listaDeModulos.forEach((modulo) => {
      Object.entries(modulo.acoes).forEach(([acaoChave, acao]) => {
        mapa.set(`${modulo.chave}:${acaoChave}`, { modulo, acao });
      });
    });
    return mapa;
  }, [listaDeModulos]);

  const rotuloDaPermissao = useCallback(
    (id) => {
      const achado = indice.get(id);
      if (!achado) return id;
      return `${achado.modulo.label} · ${achado.acao.label}`;
    },
    [indice]
  );

  const descricaoDaPermissao = useCallback(
    (id) => indice.get(id)?.acao.descricao ?? "",
    [indice]
  );

  const idsDoModulo = useCallback(
    (moduloChave) =>
      Object.keys(modulos[moduloChave]?.acoes ?? {}).map(
        (acao) => `${moduloChave}:${acao}`
      ),
    [modulos]
  );

  return {
    modulos,
    listaDeModulos,
    niveis,
    modelos,
    indice,
    idsDoModulo,
    rotuloDaPermissao,
    descricaoDaPermissao,
    carregando,
    erro,
  };
};

export default useAccessCatalog;
