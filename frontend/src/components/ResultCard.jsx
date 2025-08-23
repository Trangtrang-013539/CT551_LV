import React from "react";
import { Card, CardContent, Typography, LinearProgress, Box } from "@mui/material";

const ResultCard = ({ className, confidence }) => {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight="bold">
          {className}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <LinearProgress
            variant="determinate"
            value={confidence * 100}
            sx={{ flexGrow: 1, height: 10, borderRadius: 5 }}
            color={confidence > 0.5 ? "primary" : "secondary"}
          />
          <Typography variant="body2" sx={{ minWidth: 45 }}>
            {(confidence * 100).toFixed(1)}%
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ResultCard;
