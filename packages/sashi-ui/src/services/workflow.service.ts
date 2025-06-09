import axios, { AxiosResponse } from 'axios';
import { WorkflowExecutionResponse, WorkflowResponse } from '../models/payload';

export const sendExecuteWorkflow = async (
    apiUrl: string,
    workflow: WorkflowResponse
): Promise<AxiosResponse<WorkflowExecutionResponse>> => {
    const response = await axios.post<WorkflowExecutionResponse>(`${apiUrl}/workflow/execute`, {
        workflow: workflow,
    });

    return response;
};
