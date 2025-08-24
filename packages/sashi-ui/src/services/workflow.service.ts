import axios, { AxiosResponse } from 'axios';
import { WorkflowExecutionResponse, WorkflowResponse } from '../models/payload';

export const sendExecuteWorkflow = async (
    apiUrl: string,
    payload: WorkflowResponse | { workflow: WorkflowResponse, userInput?: Record<string, any>, debug?: boolean }
): Promise<AxiosResponse<WorkflowExecutionResponse>> => {
    // Handle both old format (just WorkflowResponse) and new format (with userInput)
    const requestBody = 'workflow' in payload && payload.workflow 
        ? payload  // New format with userInput
        : { workflow: payload };  // Old format - wrap in workflow property

    const response = await axios.post<WorkflowExecutionResponse>(`${apiUrl}/workflow/execute`, requestBody);

    return response;
};
