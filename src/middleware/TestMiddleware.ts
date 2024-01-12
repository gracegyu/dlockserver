import { Injectable, NestMiddleware } from '@nestjs/common';
@Injectable()
export class TestMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void): any {
    console.log('테스트 미들웨어 1 실행');
    const query = req.query.name;
    res.send(`테스트 미들웨어 쿼리 name=${query}`);
    return; //Middleware 이후 코드 실행X
  }
}
@Injectable()
export class TestMiddleware2 implements NestMiddleware {
  use(req: any, res: any, next: () => void): any {
    console.log(req.query);
    console.log('테스트 미들웨어 2 실행');
    next(); //Middleware 이후 코드를 실행
  }
}
