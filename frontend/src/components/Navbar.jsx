import React from "react";
import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import { Link, useLocation } from "react-router-dom";

const Navbar = () => {
  const location = useLocation();

  return (
    <AppBar position="static" color="primary">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Image AI Demo
        </Typography>
        <Box>
          <Button
            color="inherit"
            component={Link}
            to="/"
            sx={{ fontWeight: location.pathname === "/" ? "bold" : "normal" }}
          >
            Home
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/classify"
            sx={{ fontWeight: location.pathname === "/classify" ? "bold" : "normal" }}
          >
            Phân loại ảnh
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/similar"
            sx={{ fontWeight: location.pathname === "/similar" ? "bold" : "normal" }}
          >
            Tìm ảnh tương đồng
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
