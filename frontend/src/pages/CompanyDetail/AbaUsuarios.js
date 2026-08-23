import React, { useCallback, useEffect, useState } from "react";

import makeStyles from "@mui/styles/makeStyles";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import EditIcon from "@mui/icons-material/Edit";
import SecurityIcon from "@mui/icons-material/Security";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt1";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import EmptyState from "../../components/EmptyState";
import UserAccessModal from "../../components/Access/UserAccessModal";
import useAccessCatalog from "../../hooks/useAccessCatalog";
import { lerExcecoes } from "../../helpers/permissoes";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  cabecalho: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },

  explicacao: {
    maxWidth: 620,
    color: theme.palette.text.secondary,
  },

  carregando: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(6),
  },

  tabela: { minWidth: 900 },
}));

/**
 * Quem usa o sistema nesta empresa.
 *
 * A divisão entre o que se edita daqui e o que se edita lá dentro segue quem
 * precisa do contexto da empresa para decidir. Cargo e permissões não
 * precisam: são as mesmas opções em toda instalação, e são justamente o que o
 * super ajusta de fora — obrigá-lo a entrar na empresa a cada mudança de
 * permissão era ida e volta para trocar um seletor.
 *
 * Nome, e-mail, senha e setores continuam na tela de Usuários da empresa.
 * Setor depende das filas dela, número padrão depende das conexões dela, e
 * mexer nisso sem ver esses cadastros é como se criam vínculos quebrados.
 *
 * A matriz de permissões dentro do modal é o mesmo componente que a empresa
 * usa: não existe uma segunda versão para manter em dia.
 */
const AbaUsuarios = ({ company, onEntrar }) => {
  const classes = useStyles();
  const catalogo = useAccessCatalog();
  const [users, setUsers] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get(`/companies/${company.id}/users`);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      toastError(err);
    } finally {
      setCarregando(false);
    }
  }, [company.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (carregando) {
    return (
      <div className={classes.carregando}>
        <CircularProgress />
      </div>
    );
  }

  // Conta pelo cargo de sistema, e não pelo profile: era o profile que dizia
  // quem era administrador, e ele não diz mais nada sobre acesso.
  const administradores = users.filter((u) => u.role?.isSystem).length;

  return (
    <>
      {editando && !catalogo.carregando && (
        <UserAccessModal
          open
          userId={editando.id}
          userName={editando.name}
          companyId={company.id}
          acessoInicial={{
            roleId: editando.roleId,
            exceptions: lerExcecoes(editando.accessExceptions),
          }}
          catalogo={catalogo}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}

      <div className={classes.cabecalho}>
        <div className={classes.explicacao}>
          <Typography variant="body2">
            {users.length} usuário(s), {administradores} administrador(es).
          </Typography>
          <Typography variant="caption">
            Cargo e permissões você muda aqui. Nome, e-mail, senha e setores
            continuam na tela de Usuários da empresa, que conhece as filas e
            as conexões dela.
          </Typography>
        </div>

        <Button
          variant="contained"
          color="primary"
          startIcon={<PersonAddAltIcon />}
          onClick={() => onEntrar(company, "/users")}
        >
          Gerenciar usuários
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={PeopleAltOutlinedIcon}
          title="Nenhum usuário nesta empresa"
          description="Uma empresa sem usuário não tem como ser acessada. Entre nela e crie ao menos o administrador."
          action={
            <Button
              variant="contained"
              color="primary"
              startIcon={<PersonAddAltIcon />}
              onClick={() => onEntrar(company, "/users")}
            >
              Criar o primeiro usuário
            </Button>
          }
        />
      ) : (
        <Table size="small" className={classes.tabela}>
          <TableHead>
            <TableRow>
              <TableCell align="center">Status</TableCell>
              <TableCell>Nome</TableCell>
              <TableCell>E-mail</TableCell>
              <TableCell>Cargo</TableCell>
              <TableCell>Setores</TableCell>
              <TableCell align="center">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell align="center">
                  <Tooltip
                    arrow
                    title={
                      user.online
                        ? i18n.t("users.table.online")
                        : i18n.t("users.table.offline")
                    }
                  >
                    <FiberManualRecordIcon
                      fontSize="small"
                      color={user.online ? "success" : "disabled"}
                      style={{ verticalAlign: "middle" }}
                    />
                  </Tooltip>
                </TableCell>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  {user.role?.name || (
                    <Typography variant="caption" color="error">
                      sem cargo
                    </Typography>
                  )}
                  {user.accessExceptions && (
                    <Typography variant="caption" color="textSecondary">
                      {" "}+ exceções
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {user.queues?.length
                    ? user.queues.map((q) => (
                        <Chip
                          key={q.id}
                          size="small"
                          variant="outlined"
                          label={q.name}
                          style={{ marginRight: 4 }}
                        />
                      ))
                    : "—"}
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Mudar cargo e permissões" arrow>
                    <span>
                      <Button
                        size="small"
                        startIcon={<SecurityIcon />}
                        disabled={user.profile === "super"}
                        onClick={() => setEditando(user)}
                      >
                        Cargo e acesso
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title="Entrar na empresa para editar o cadastro" arrow>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => onEntrar(company, "/users")}
                    >
                      Cadastro
                    </Button>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
};

export default AbaUsuarios;
