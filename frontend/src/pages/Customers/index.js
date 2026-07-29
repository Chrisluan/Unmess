import React, { useState, useEffect, useReducer } from "react";
import openSocket from "../../services/socket-io";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Chip from "@material-ui/core/Chip";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";

import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import CustomerModal from "../../components/CustomerModal";
import ConfirmationModal from "../../components/ConfirmationModal/";

import { i18n } from "../../translate/i18n";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { Can } from "../../components/Can";

const reducer = (state, action) => {
  if (action.type === "LOAD_CUSTOMERS") {
    const customers = action.payload;
    const newCustomers = [];

    customers.forEach((customer) => {
      const customerIndex = state.findIndex((c) => c.id === customer.id);
      if (customerIndex !== -1) {
        state[customerIndex] = customer;
      } else {
        newCustomers.push(customer);
      }
    });

    return [...state, ...newCustomers];
  }

  if (action.type === "UPDATE_CUSTOMERS") {
    const customer = action.payload;
    const customerIndex = state.findIndex((c) => c.id === customer.id);

    if (customerIndex !== -1) {
      state[customerIndex] = customer;
      return [...state];
    } else {
      return [customer, ...state];
    }
  }

  if (action.type === "DELETE_CUSTOMER") {
    const customerId = action.payload;

    const customerIndex = state.findIndex((c) => c.id === customerId);
    if (customerIndex !== -1) {
      state.splice(customerIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
}));

const statusColors = {
  lead: "default",
  active: "primary",
  inactive: "secondary",
};

const Customers = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [customers, dispatch] = useReducer(reducer, []);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchCustomers = async () => {
        try {
          const { data } = await api.get("/customers", {
            params: { searchParam, pageNumber },
          });
          dispatch({ type: "LOAD_CUSTOMERS", payload: data.customers });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchCustomers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("customer", (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CUSTOMERS", payload: data.customer });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_CUSTOMER", payload: +data.customerId });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenCustomerModal = () => {
    setSelectedCustomerId(null);
    setCustomerModalOpen(true);
  };

  const handleCloseCustomerModal = () => {
    setSelectedCustomerId(null);
    setCustomerModalOpen(false);
  };

  const handleEditCustomer = (customerId) => {
    setSelectedCustomerId(customerId);
    setCustomerModalOpen(true);
  };

  const handleDeleteCustomer = async (customerId) => {
    try {
      await api.delete(`/customers/${customerId}`);
      toast.success(i18n.t("customers.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingCustomer(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  return (
    <MainContainer className={classes.mainContainer}>
      <CustomerModal
        open={customerModalOpen}
        onClose={handleCloseCustomerModal}
        aria-labelledby="form-dialog-title"
        customerId={selectedCustomerId}
      ></CustomerModal>
      <ConfirmationModal
        title={
          deletingCustomer
            ? `${i18n.t("customers.confirmationModal.deleteTitle")} ${
                deletingCustomer.name
              }?`
            : ""
        }
        open={confirmOpen}
        onClose={setConfirmOpen}
        onConfirm={() =>
          deletingCustomer && handleDeleteCustomer(deletingCustomer.id)
        }
      >
        {i18n.t("customers.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <MainHeader>
        <Title>{i18n.t("customers.title")}</Title>
        <MainHeaderButtonsWrapper>
          <TextField
            placeholder={i18n.t("customers.searchPlaceholder")}
            type="search"
            value={searchParam}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon style={{ color: "gray" }} />
                </InputAdornment>
              ),
            }}
          />
          <Can permission="clients:create">
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenCustomerModal}
            >
              {i18n.t("customers.buttons.add")}
            </Button>
          </Can>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{i18n.t("customers.table.name")}</TableCell>
              <TableCell align="center">
                {i18n.t("customers.table.document")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("customers.table.phone")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("customers.table.segment")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("customers.table.status")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("customers.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    {customer.tradeName || customer.name}
                  </TableCell>
                  <TableCell align="center">{customer.document}</TableCell>
                  <TableCell align="center">
                    {customer.whatsapp || customer.phone}
                  </TableCell>
                  <TableCell align="center">{customer.segment}</TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={i18n.t(`customers.status.${customer.status}`)}
                      color={statusColors[customer.status] || "default"}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Can permission="clients:edit">
                      <IconButton
                        size="small"
                        onClick={() => handleEditCustomer(customer.id)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Can>
                    <Can permission="clients:delete">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setConfirmOpen(true);
                          setDeletingCustomer(customer);
                        }}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
              {loading && <TableRowSkeleton columns={6} />}
            </>
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default Customers;
