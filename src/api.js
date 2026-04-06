import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000";

export const fetchGraph = async (workflowId) => {
  const response = await axios.get(
    `${BASE_URL}/workflow-graph/${workflowId}`
  );
  return response.data;
};
