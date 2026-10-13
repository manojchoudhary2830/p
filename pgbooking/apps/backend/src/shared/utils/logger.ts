import winston from 'winston';
import { env } from '@config/environment';

const IS_PRODUCTION = env.NODE_ENV === 'production';
const LOG_LEVEL = (env as any).LOG_LEVEL ?? (IS_PRODUCTION ? 'info' : 'debug');

const jsonFormat = winston.format.printf((info: any) => {
  const { level, message, timestamp, requestId, splat, ...rest } = info;
  return JSON.stringify({
    ts: timestamp, level, msg: message,
    ...(requestId ? { requestId } : {}),
    ...(Object.keys(rest).length > 0 ? { meta: rest } : {}),
  });
});

const prettyFormat = winston.format.printf((info: any) => {
  const { level, message, timestamp, requestId, splat, ...rest } = info;
  const ts   = (timestamp as string)?.slice(11, 23) ?? '';
  const rid  = requestId ? ` [${String(requestId).slice(0, 8)}]` : '';
  const meta = Object.keys(rest).length > 0 ? '\n' + JSON.stringify(rest, null, 2) : '';
  return `${ts} ${level.toUpperCase().padEnd(5)}${rid} ${message}${meta}`;
});

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      IS_PRODUCTION ? jsonFormat : winston.format.combine(winston.format.colorize({ all: true }), prettyFormat),
    ),
  }),
];

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports,
  exitOnError: false,
  silent: env.NODE_ENV === 'test',
});

export const morganStream = {
  write: (message: string): void => { logger.http(message.trim()); },
};
