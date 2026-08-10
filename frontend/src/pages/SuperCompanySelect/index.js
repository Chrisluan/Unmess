import React, { useContext, useEffect, useReducer, useState } from "react";
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
  Container,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';
import {
  Business,
  CheckCircle,
  ExitToApp,
  Search,
  Warning,
  Add,
} from "@mui/icons-material";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import CompanyModal from "../../components/CompanyModal";

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
  statusActive: {
    backgroundColor: "#e8f5e9",
    color: "#2e7d32",
  },
  statusSuspended: {
    backgroundColor: "#fff3e0",
    color: "#e65100",
  },
  statusCanceled: {
    backgroundColor: "#fce4ec",
    color: "#c62828",
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
  const { user, handleSelectCompany, handleLogout } = useContext(AuthContext);

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
      <TextField
        className={classes.search}
        variant="outlined"
        size="small"
        placeholder="Buscar empresa por nome, CNPJ ou e-mail..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
      />

      {/* Lista */}
      {loading ? (
        <Box className={classes.loading}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Box className={classes.empty}>
          <Business style={{ fontSize: 48, opacity: 0.3 }} />
          {companies.length === 0 ? (
            <>
              <Typography>
                Nenhuma empresa cadastrada ainda.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<Add />}
                style={{ marginTop: 16 }}
                onClick={() => setCompanyModalOpen(true)}
              >
                Cadastrar primeira empresa
              </Button>
            </>
          ) : (
            <Typography>Nenhuma empresa encontrada para essa busca</Typography>
          )}
        </Box>
      ) : (
        <Box className={classes.grid}>
          {filtered.map((company) => {
            const isSelecting = selecting === company.id;
            const inactive = company.status !== "active";

            return (
              <Card key={company.id} className={classes.card} elevation={0}>
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
                        size="small"
                        className={
                          company.status === "active"
                            ? classes.statusActive
                            : company.status === "suspended"
                            ? classes.statusSuspended
                            : classes.statusCanceled
                        }
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
