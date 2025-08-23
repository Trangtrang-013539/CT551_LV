import React, { useState } from "react";
import { Box, Button, Typography } from "@mui/material";

const UploadZone = ({ onFilesSelected, accept = "image/*,application/pdf" }) => {
  const [dragging, setDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
    }
  };

  const handleFileInputChange = (e) => {
    onFilesSelected(Array.from(e.target.files));
  };

  return (
    <Box
      sx={{
        border: "2px dashed",
        borderColor: dragging ? "primary.main" : "grey.400",
        borderRadius: 2,
        p: 4,
        textAlign: "center",
        cursor: "pointer",
        transition: "border-color 0.3s",
        bgcolor: dragging ? "action.hover" : "transparent",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById("fileInput").click()}
    >
      <input
        id="fileInput"
        type="file"
        multiple
        hidden
        accept={accept}
        onChange={handleFileInputChange}
      />
      <Typography variant="h6" color="textSecondary" gutterBottom>
        Kéo thả ảnh hoặc file PDF vào đây
      </Typography>
      <Button variant="outlined" color="primary">
        Hoặc chọn file thủ công
      </Button>
    </Box>
  );
};

export default UploadZone;
