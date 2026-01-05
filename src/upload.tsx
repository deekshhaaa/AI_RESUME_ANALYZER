import React, { useState } from "react";
import axios from "axios";

const UploadComponent = () => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post("/upload", formData);
      setError(null);
      // Handle successful upload
    } catch (error) {
      console.error("Upload error details:", error);
      setError("An error occurred while uploading the file. Please try again.");
    }
  };

  const handleAnalyze = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
      headers: {
        "x-model": "claude-3-5-sonnet", // Use Puter.js supported model
      },
    });

    const data = await response.json();

    if (!data.success) {
      console.error("API Error:", data.error);
      throw new Error(data.error || "Analysis failed");
    }

    setError(null);
    // Handle successful analysis
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload</button>
      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default UploadComponent;
