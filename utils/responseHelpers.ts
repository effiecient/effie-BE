
import { STATUS_SUCCESS, STATUS_ERROR } from "../config";

export function sendError(res: any, status: number, message: string) {
  return res.status(status).json({
    status: STATUS_ERROR,
    message
  });
}

export function sendSuccess(res: any, data?: any) {
  return res.status(200).json({
    status: STATUS_SUCCESS,
    ...(data && { data })
  });
}

export function validateUserAccess(
  currentUser: string,
  owner: string,
  publicAccess: string,
  personalAccess: any[]
): boolean {
  return currentUser === owner || 
         publicAccess === "editor" || 
         personalAccess.some(item => 
           item.username === currentUser && item.access === "editor"
         );
}
