// import moment from 'moment-timezone'; //시간 처리 모듈
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { format } from 'winston';
// import DailyRotateFile from 'winston-daily-rotate-file';
const { combine, timestamp } = format;
import { Logger } from '@nestjs/common';
const nestLogger = new Logger('lockServer');

// function timestampFormat() {
//   return moment()
//     .tz(process.env.WINSTON_TIMEZONE)
//     .format('YYYY-MM-DD HH:mm:ss.SSS ZZ');
// }

const myFormat = format.printf((info) => {
  return `${info.timestamp} - ${info.level}: ${info.message}`;
});

const winstonLogger = winston.createLogger({
  //createLogger 로 바꿔야 에러 안남
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss:SSS' }), myFormat),
  // format: combine(timestamp({ format: timestampFormat }), myFormat),
  transports: [
    new winston.transports.DailyRotateFile({
      // name: 'info-file',
      filename: './log/server_%DATE%.log', //%DATE% 필요
      datePattern: 'YYYY-MM-DD', //datePattern 수정
      // colorize: false,
      maxSize: 50000000,
      maxFiles: 1000,
      level: 'info',
      // showLevel: true,
      json: false,
      // timestamp: timestampFormat,
    }),
    new winston.transports.Console({
      // name: 'debug-console',
      // colorize: true,
      level: 'debug',
      // showLevel: true,
      // json: false,
      // timestamp: timestampFormat,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.DailyRotateFile({
      // name: 'exception-file',
      filename: './log/exception_%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      // colorize: false,
      // maxsize: 50000000,
      level: 'error',
      // showLevel: true,
      json: false,
      // timestamp: timestampFormat,
    }),
    new winston.transports.Console({
      // name: 'exception-console',
      // colorize: true,
      level: 'debug',
      // showLevel: true,
      // json: false,
      // timestamp: timestampFormat,
    }),
  ],
});

// winstonLogger.debug('hi');
// winstonLogger.info('hi');

export function ErrorLog(message: string): void {
  // const filename = __filename2.replace(/^.*[\\\/]/, '');
  winstonLogger.error(
    // `(${filename}:${__function2}:${__line2}) : ` +
    message + '\nCall Stack: ' + new Error().stack,
  );
}

export function WarnLog(message: string): void {
  nestLogger.warn(message);
  winstonLogger.warn(message + '\nCall Stack: ' + new Error().stack);

  // const filename = __filename2.replace(/^.*[\\\/]/, '');
  winstonLogger.warn(
    // `(${filename}:${__function2}:${__line2}) : ` +
    message + '\nCall Stack: ' + new Error().stack,
  );
}

export function InfoLog(message: string): void {
  nestLogger.log(message);
  winstonLogger.info(message);
}

export function DebugLog(message: string): void {
  nestLogger.debug(message);
  winstonLogger.debug(message + '\nCall Stack: ' + new Error().stack);
}

export async function RequestLog(ctx: any, next: any): Promise<any> {
  console.log('RequestLog', ctx.request.header['user-agent']);
  let message = ctx.request.method + ' ' + ctx.request.url + ' ';
  message += `(ip:${ctx.socket?.remoteAddress} agent:${ctx.request.header['user-agent']} ) `;
  message += JSON.stringify(ctx.request.body) + ' ';
  nestLogger.log(message);
  winstonLogger.info(message);
  return next();
}

Object.defineProperty(global, '__stack', {
  get: function () {
    const orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function (_, stack) {
      return stack;
    };
    const err = new Error();
    Error.captureStackTrace(err, arguments.callee);
    const stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;
  },
});

// Object.defineProperty(global, '__line', {
//   get: function () {
//     return __stack[1].getLineNumber();
//   },
// });

// Object.defineProperty(global, '__function', {
//   get: function () {
//     return __stack[1].getFunctionName();
//   },
// });

// Object.defineProperty(global, '__line2', {
//   get: function () {
//     return __stack[2].getLineNumber();
//   },
// });

// Object.defineProperty(global, '__function2', {
//   get: function () {
//     return __stack[2].getFunctionName();
//   },
// });

// Object.defineProperty(global, '__filename2', {
//   get: function () {
//     return __stack[2].getFileName();
//   },
// });
