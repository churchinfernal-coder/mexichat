import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:3001/api";

// Create axios instance with auth interceptor
const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mexichat_token"); // Your existing JWT
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── OAuth ───
export const getConnectUrl  = ()  => api.get("/oauth/connect");
export const getOAuthStatus = ()  => api.get("/oauth/status");
export const disconnectMP   = ()  => api.post("/oauth/disconnect");

// ─── Payments ───
export const sendMoney = ({ receiverId, receiverEmail, amount, description }) =>
  api.post("/payments/send", { receiverId, receiverEmail, amount, description });

export const getTransactionHistory = (page = 1, limit = 20) =>
  api.get(`/payments/history?page=${page}&limit=${limit}`);

export const getTransaction = (id) => api.get(`/payments/${id}`);

export default api;
