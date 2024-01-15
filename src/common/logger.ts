import * as fs from 'fs';
import * as moment from 'moment';
import 'moment-timezone';
// import winston from 'winston';
import { createLogger, transports } from 'winston';
import 'winston-daily-rotate-file';

const logDir = __dirname + '/../../logs';

if (!fs.existsSync(logDir)) {
  console.log('logDir', logDir);
  fs.mkdirSync(logDir);
}

const infoTransport = new transports.DailyRotateFile({
  filename: 'info.log',
  dirname: logDir,
  level: 'info',
  maxFiles: '30d', // 30일치 저장
});

const errorTransport = new transports.DailyRotateFile({
  filename: 'error.log',
  dirname: logDir,
  level: 'error',
  maxFiles: '30d', // 30일치 저장
});

moment.tz.setDefault('Asia/Seoul'); // 로그 시간대 한국 기준으로 변경
const timeStamp = () => moment().format('YYYY-MM-DD HH:mm:ss');

const logger = createLogger({
  transports: [infoTransport, errorTransport],
});

const stream = {
  write: (message: string) => {
    logger.info(`${timeStamp()} ${message}`);
  },
};

export { logger, stream };
