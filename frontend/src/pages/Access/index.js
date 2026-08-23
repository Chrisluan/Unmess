import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import AddIcon from "@mui/icons-material/Add";
import {
  DeleteOutline,
  Edit,
  LockOutlined,
  TuneOutlined,
} from "@mui/icons-material";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ConfirmationModal from "../../components/ConfirmationModal";
import RoleModal from "../../components/Access/RoleModal";
import UserAccessModal from "../../components/Access/UserAccessModal";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import usePermissions from "../../hooks/usePermissions";
import useAccessCatalog from "../../hooks/useAccessCatalog";
import openSocket from "../../services/socket-io";

const useStyles = makeStyles((theme) => ({
  descricao: {
    padding: theme.spacing(1.5, 2, 0),
    maxWidth: 760,
    color: theme.palette.text.secondary,
    fontSize: 13.5,
  },
  abas: {
    padding: theme.spacing(0, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  mainPaper: {
    flex: 1,
    margin: theme.spacing(1.5, 2, 2),
    padding: theme.spacing(0.5),
    overflowY: "auto",
    overflowX: "auto",
    border: `1px solid ${theme.palette.divider}`,
    ...theme.scrollbarStyles,
  },
  nomeCargo: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    fontWeight: 600,
  },
  descricaoCargo: {
    fontSize: 12.5,
    color: theme.palette.text.secondary,
    display: "block",
    maxWidth: 460,
  },
  semCargo: {
    color: theme.palette.error.main,
    fontStyle: "italic",
  },
  excecoes: { display: "flex", gap: 4 },
}));

/**
 * Cargos e acessos.
 *
 * Substitui a tela de "Perfis de acesso", que tinha um problema de fundo:
 * mostrava os grupos de permissão como se eles decidissem o acesso, enquanto
 * quem decidia de verdade era o campo "Perfil" na tela de Usuários — um
 * seletor com admin, vendedor, produção, instalação e financeiro, dos quais
 * só "admin" fazia alguma coisa (liberava tudo). Quem administrava escolhia
 * "vendedor" achando que estava restringindo, e não estava restringindo nada.
 *
 * Agora são duas abas e um conceito só. Em Cargos se define o que cada cargo
 * libera; em Pessoas, quem tem qual cargo. Não há terceiro lugar onde acesso
 * mude de mão.
 */
const Access = () => {
  const classes = useStyles();
  const { can } = usePermissions();
  const catalogo = useAccessCatalog();

  const [aba, setAba] = useState("cargos");
  const [cargos, setCargos] = useState([]);
  const [pessoas, setPessoas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [cargoEmEdicao, setCargoEmEdicao] = useState(undefined);
  const [pessoaEmEdicao, setPessoaEmEdicao] = useState(null);
  const [cargoParaExcluir, setCargoParaExcluir] = useState(null);

  const podeGerenciarCargos = can("roles:manage");
  const podeAtribuir = can("roles:assign");
  const podeVerPessoas = can("users:view");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const pedidos = [api.get("/access/roles")];
      if (podeVerPessoas) pedidos.push(api.get("/users", { params: { pageNumber: 1 } }));

      const [respostaCargos, respostaPessoas] = await Promise.all(pedidos);
      setCargos(respostaCargos.data ?? []);
      setPessoas(respostaPessoas?.data?.users ?? []);
    } catch (err) {
      toastError(err);
    } finally {
      setCarregando(false);
    }
  }, [podeVerPessoas]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Cargo mexido em outra aba do navegador, ou por outra pessoa, aparece aqui
  // sem precisar recarregar a página: a lista atual passaria a mentir.
  useEffect(() => {
    const socket = openSocket();
    socket.on("access", () => carregar());
    return () => socket.disconnect();
  }, [carregar]);

  const excluirCargo = async () => {
    if (!cargoParaExcluir) return;
    try {
      await api.delete(`/access/roles/${cargoParaExcluir.id}`);
      toast.success("Cargo excluído.");
      carregar();
    } catch (err) {
      toastError(err);
    } finally {
      setCargoParaExcluir(null);
    }
  };

  const nomeDoCargo = (pessoa) =>
    pessoa.role?.name ?? cargos.find((c) => c.id === pessoa.roleId)?.name ?? null;

  return (
    <MainContainer>
      <ConfirmationModal
        title={`Excluir o cargo "${cargoParaExcluir?.name ?? ""}"?`}
        open={!!cargoParaExcluir}
        onClose={() => setCargoParaExcluir(null)}
        onConfirm={excluirCargo}
      >
        As pessoas que tiverem este cargo precisam receber outro antes. Quem
        fica sem cargo entra no sistema e não vê tela nenhuma.
      </ConfirmationModal>

      {cargoEmEdicao !== undefined && !catalogo.carregando && (
        <RoleModal
          open
          roleId={cargoEmEdicao}
          catalogo={catalogo}
          onClose={() => setCargoEmEdicao(undefined)}
          onSaved={carregar}
        />
      )}

      {pessoaEmEdicao && !catalogo.carregando && (
        <UserAccessModal
          open
          userId={pessoaEmEdicao.id}
          userName={pessoaEmEdicao.name}
          catalogo={catalogo}
          onClose={() => setPessoaEmEdicao(null)}
          onSaved={carregar}
        />
      )}

      <MainHeader>
        <Title>Cargos e acessos</Title>
        <MainHeaderButtonsWrapper>
          {aba === "cargos" && podeGerenciarCargos && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setCargoEmEdicao(null)}
            >
              Novo cargo
            </Button>
          )}
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Typography className={classes.descricao}>
        O cargo define o que a pessoa pode fazer. Comece pelo cargo; use as
        exceções individuais só quando uma pessoa precisar de algo que o cargo
        dela não prevê.
      </Typography>

      <Box className={classes.abas}>
        <Tabs value={aba} onChange={(_e, valor) => setAba(valor)}>
          <Tab label={`Cargos (${cargos.length})`} value="cargos" />
          {podeVerPessoas && (
            <Tab label={`Pessoas (${pessoas.length})`} value="pessoas" />
          )}
        </Tabs>
      </Box>

      {catalogo.erro && (
        <Alert severity="error" style={{ margin: "12px 16px" }}>
          Não foi possível carregar o catálogo de permissões. Recarregue a
          página; sem ele, a edição de cargos não tem como funcionar.
        </Alert>
      )}

      <Paper className={classes.mainPaper} variant="outlined">
        {aba === "cargos" ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Cargo</TableCell>
                <TableCell align="center">Permissões</TableCell>
                <TableCell align="center">Pessoas</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {carregando ? (
                <TableRowSkeleton columns={4} />
              ) : (
                cargos.map((cargo) => (
                  <TableRow key={cargo.id} hover>
                    <TableCell>
                      <span className={classes.nomeCargo}>
                        {cargo.name}
                        {cargo.isSystem && (
                          <Tooltip
                            arrow
                            title="Cargo do sistema: tem todas as permissões, inclusive as que forem criadas no futuro, e não pode ser editado nem excluído."
                          >
                            <LockOutlined fontSize="inherit" color="disabled" />
                          </Tooltip>
                        )}
                      </span>
                      {cargo.description && (
                        <Typography
                          component="span"
                          className={classes.descricaoCargo}
                        >
                          {cargo.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">{cargo.permissions.length}</TableCell>
                    <TableCell align="center">{cargo.userCount}</TableCell>
                    <TableCell align="right">
                      <Tooltip
                        arrow
                        title={
                          cargo.isSystem
                            ? "O cargo de Administrador não é editável"
                            : podeGerenciarCargos
                            ? "Editar cargo"
                            : "Você pode ver, mas não editar cargos"
                        }
                      >
                        <span>
                          <IconButton
                            size="small"
                            disabled={cargo.isSystem || !podeGerenciarCargos}
                            onClick={() => setCargoEmEdicao(cargo.id)}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip
                        arrow
                        title={
                          cargo.isSystem
                            ? "O cargo de Administrador não pode ser excluído"
                            : cargo.userCount > 0
                            ? `${cargo.userCount} pessoa(s) usam este cargo`
                            : "Excluir cargo"
                        }
                      >
                        <span>
                          <IconButton
                            size="small"
                            disabled={
                              cargo.isSystem ||
                              cargo.userCount > 0 ||
                              !podeGerenciarCargos
                            }
                            onClick={() => setCargoParaExcluir(cargo)}
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Pessoa</TableCell>
                <TableCell>Cargo</TableCell>
                <TableCell align="center">Exceções</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {carregando ? (
                <TableRowSkeleton columns={4} />
              ) : (
                pessoas.map((pessoa) => (
                  <TableRow key={pessoa.id} hover>
                    <TableCell>
                      {pessoa.name}
                      <Typography
                        component="span"
                        className={classes.descricaoCargo}
                      >
                        {pessoa.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {nomeDoCargo(pessoa) ?? (
                        <span className={classes.semCargo}>Sem cargo</span>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {/* A contagem vem do detalhe; na lista basta saber se
                          esta pessoa foge do cargo dela. */}
                      {pessoa.accessExceptions ? (
                        <Chip size="small" variant="outlined" label="tem exceções" />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip
                        arrow
                        title={
                          podeAtribuir
                            ? "Definir cargo e exceções"
                            : "Você não tem permissão para alterar acessos"
                        }
                      >
                        <span>
                          <IconButton
                            size="small"
                            disabled={!podeAtribuir}
                            onClick={() => setPessoaEmEdicao(pessoa)}
                          >
                            <TuneOutlined fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Paper>
    </MainContainer>
  );
};

export default Access;
