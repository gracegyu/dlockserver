import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
@Controller('test') //테스트를 위한 컨트롤러
export class TestController {
  constructor(private readonly appService: AppService) {}
  @Get()
  getHello(): string {
    return this.appService.getTest(); //app.service.ts에 추가했던 GetTest()
  }
  @Get('query-test')
  getTest(@Query('query') query: string): string {
    return `입력받은 쿼리는 ${query}입니다.`;
  }
  @Get('middleware-test')
  getTestMiddleware(): string {
    console.log('middleware-test 컨트롤러');
    return 'middleware-test 컨트롤러';
  }
  @Get('middleware-test2')
  getTestMiddleware2(): string {
    console.log('middleware-test2 컨트롤러');
    return 'middleware-test2 컨트롤러';
  }
}

@Controller('info')
export class InfoController {
  constructor(private readonly appService: AppService) {}
  @Get()
  getHello(): string {
    return this.appService.getInfo();
  }
}
