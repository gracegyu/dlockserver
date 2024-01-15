import { Injectable } from '@nestjs/common';
import { state } from './common/state';

@Injectable()
export class AppService {
  constructor() {
    console.log('서비스 생성');
  }
  getHello(): string {
    console.log('getHello() Hello World!');
    return 'Hello World!';
  }
  getTest(): string {
    return '이것은 테스트입니다.';
  }
  getInfo(): string {
    return JSON.stringify({
      command: 'info',
      numConnections: state.numConnections,
      numLocks: state.numLocks,
      numWatchs: state.numWatchs,
    });
  }
}
