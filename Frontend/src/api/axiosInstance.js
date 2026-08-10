import axios from "axios";

const api = axios.create({
  // Production me same domain se serve hoga (no cross-origin)
  // Local dev me vite.config.js ka proxy handle karega
  baseURL: "/api", 
});

api.interceptors.request.use((config) => {
  // Check standard token first, then fallback to the iipsCurrentSession object we used in newer components
  const standardToken = localStorage.getItem("token");
  const sessionToken = JSON.parse(localStorage.getItem('iipsCurrentSession') || '{}').token;
  
  const finalToken = standardToken || sessionToken;

  if (finalToken) {
    config.headers.Authorization = `Bearer ${finalToken}`; 
  }
  
  return config;
});

export default api;