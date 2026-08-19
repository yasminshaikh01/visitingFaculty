import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const api = axios.create({
  baseURL: `${backendUrl.replace(/\/+$/, "")}/api`,
});

api.interceptors.request.use((config) => {
  // UPDATED: Now reading from sessionStorage to prevent multi-tab conflicts
  const token = sessionStorage.getItem("token");

  console.log("Axios checking token for", config.url, "->", token ? "Found it!" : "EMPTY!");
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;