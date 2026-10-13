import { RequestUser } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      requestId?: string;
      startTime?: number;
    }
  }
}

export {};
