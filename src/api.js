import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL;

export const fetchGraph = async (workflowId) => {
  const response = await axios.get(
    `${BASE_URL}/workflow-graph/${workflowId}`
  );
  return response.data;
};
