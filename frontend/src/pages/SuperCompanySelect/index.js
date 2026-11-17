import React, { useContext, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Typography,
} from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';
import {
  Business,
  CheckCircle,
  ExitToApp,
  Add,
  Tune,
} from "@mui/icons-material";
import SearchOffIcon from "@mui/icons-material/SearchOff";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import CompanyModal from "../../components/CompanyModal";
import EmptyState from "../../components/EmptyState";
import SearchField from "../../components/SearchField";

const useStyles = makeStyles((theme) => ({
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.palette.background.default,
    padding: theme.spacing(3),
  },
  header: {
    textAlign: "center",
    marginBottom: theme.spacing(4),
  },
  headerActions: {
    marginTop: theme.spacing(2),
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
  superBadge: {
    marginBottom: theme.spacing(1),
  },
  title: {
    fontWeight: 700,
    marginBottom: theme.spacing(1),
  },
  subtitle: {
    color: theme.palette.text.secondary,
  },
  search: {
    maxWidth: 480,
    width: "100%",
    marginBottom: theme.spacing(3),
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: theme.spacing(2),
    width: "100%",
    maxWidth: 960,
  },
  card: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius * 2,
    transition: "box-shadow 0.2s, border-color 0.2s",
    "&:hover": {
      boxShadow: theme.shadows[4],
      borderColor: theme.palette.primary.main,
    },
  },
  cardContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: theme.spacing(1),
    padding: theme.spacing(2),
  },
  avatar: {
    backgroundColor: theme.palette.primary.main,
    width: 44,
    height: 44,
    fontSize: 18,
    fontWeight: 700,
  },
  companyName: {
    fontWeight: 600,
    fontSize: 15,
    lineHeight: 1.3,
  },
  statusBase: {
    backgroundColor: "transparent",
    border: "1px solid currentColor",
    fontWeight: 700,
  },
  statusActive: {
    color: theme.palette.success.main,
  },
  statusSuspended: {
    color: theme.palette.warning.main,
  },
  statusCanceled: {
    color: theme.palette.error.main,
  },

  // Empresa suspensa ou cancelada continua clicável — às vezes é exatamente
  // nela que o super precisa entrar para resolver —, mas não pode parecer
  // igual às ativas numa grade de vinte cartões.
  cartaoInativo: {
    opacity: 0.6,
  },
  loading: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(6),
  },
  empty: {
    textAlign: "center",
    color: theme.palette.text.secondary,
    padding: theme.spacing(4),
  },
  logoutBtn: {
    marginTop: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
}));

const statusLabel = { active: "Ativa", suspended: "Suspensa", canceled: "Cancelada" };

const SuperCompanySelect = () => {
  const classes = useStyles();
  const history = useHistory();
  const { handleSelectCompany, handleLogout } = useContext(AuthContext);

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(null);
  const [search, setSearch] = useState("");
  const [companyModalOpen, setCompanyModalOpen] = useState(false);

  const loadCompanies = async () => {
    try {
      const { data } = await api.get("/companies");
      setCompanies(data.companies || data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleCloseCompanyModal = () => {
    setCompanyModalOpen(false);
    // A empresa recém-criada precisa aparecer na lista imediatamente,
    // sem exigir que o super dê refresh na página manualmente.
    setLoading(true);
    loadCompanies();
  };

  const handleSelect = async (company) => {
    setSelecting(company.id);
    try {
      await handleSelectCompany(company.id);
      history.push("/tickets");
    } catch (err) {
      toastError(err);
      setSelecting(null);
    }
  };

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.document || "").includes(search) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box className={classes.root}>
      <CompanyModal
        open={companyModalOpen}
        onClose={handleCloseCompanyModal}
        companyId={null}
      />

      {/* Header */}
      <Box className={classes.header}>
        <Chip
          icon={<CheckCircle fontSize="small" />}
          label="Super Admin"
          color="primary"
          size="small"
          className={classes.superBadge}
        />
        <Typography variant="h5" className={classes.title}>
          Selecione a empresa
        </Typography>
        <Typography variant="body2" className={classes.subtitle}>
          Você entrará como administrador da empresa selecionada.
        </Typography>
        <Box className={classes.headerActions}>
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<Tune />}
            onClick={() => history.push("/companies")}
          >
            Administrar empresas
          </Button>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<Add />}
            onClick={() => setCompanyModalOpen(true)}
          >
            Nova empresa
          </Button>
        </Box>
      </Box>

      {/* Busca */}
      <SearchField
        className={classes.search}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch("")}
        placeholder="Buscar empresa por nome, CNPJ ou e-mail"
      />

      {/* Lista */}
      {loading ? (
        <Box className={classes.loading}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={companies.length === 0 ? Business : SearchOffIcon}
          title={
            companies.length === 0
              ? "Nenhuma empresa cadastrada"
              : "Nada encontrado"
          }
          description={
            companies.length === 0
              ? "Cadastre a primeira empresa para começar a operar."
              : "Nenhuma empresa com esse nome, CNPJ ou e-mail."
          }
          action={
            companies.length === 0 && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<Add />}
                onClick={() => setCompanyModalOpen(true)}
              >
                Cadastrar primeira empresa
              </Button>
            )
          }
        />
      ) : (
        <Box className={classes.grid}>
          {filtered.map((company) => {
            const isSelecting = selecting === company.id;
            const inactive = company.status !== "active";

            return (
              <Card
                key={company.id}
                elevation={0}
                className={`${classes.card} ${inactive ? classes.cartaoInativo : ""}`}
              >
                <CardActionArea
                  onClick={() => !isSelecting && handleSelect(company)}
                  disabled={isSelecting}
                >
                  <CardContent className={classes.cardContent}>
                    <Box display="flex" alignItems="center" gap={12} style={{ gap: 12 }}>
                      <Avatar className={classes.avatar}>
                        {company.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box flex={1} minWidth={0}>
                        <Typography className={classes.companyName} noWrap>
                          {company.name}
                        </Typography>
                        {company.document && (
                          <Typography variant="caption" color="textSecondary">
                            {company.document}
                          </Typography>
                        )}
                      </Box>
                      {isSelecting && <CircularProgress size={18} />}
                    </Box>

                    <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                      <Chip
                        label={statusLabel[company.status] || company.status}
                        title={company.statusReason || undefined}
                        size="small"
                        className={`${classes.statusBase} ${
                          company.status === "active"
                            ? classes.statusActive
                            : company.status === "suspended"
                            ? classes.statusSuspended
                            : classes.statusCanceled
                        }`}
                      />
                      {company.plan && (
                        <Typography variant="caption" color="textSecondary">
                          {company.plan}
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      )}

      {/* Logout */}
      <Button
        startIcon={<ExitToApp />}
        onClick={handleLogout}
        className={classes.logoutBtn}
        size="small"
      >
        Sair
      </Button>
    </Box>
  );
};

export default SuperCompanySelect;
