import React from "react";

import makeStyles from '@mui/styles/makeStyles';

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    flex: 1,
    height: "100%",
    padding: theme.spacing(3, 4, 3),
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(2, 2, 2),
    },
  },

  contentWrapper: {
    flex: 1,
    minHeight: 0,
    overflowY: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
}));

const MainContainer = ({ children }) => {
  const classes = useStyles();

  return (
    <div className={classes.mainContainer}>
      <div className={classes.contentWrapper}>{children}</div>
    </div>
  );
};

export default MainContainer;
