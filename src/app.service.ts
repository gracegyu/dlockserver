import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor() {
    console.log('서비스 생성');
  }
  getHello(): string {
    return 'Hello World!';
  }
  getTest(): string {
    return '이것은 테스트입니다.';
  }
}
