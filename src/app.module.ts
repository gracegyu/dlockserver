import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController, TestController } from './app.controller';
import { AppService } from './app.service';
import { TestMiddleware, TestMiddleware2 } from './middleware/TestMiddleware';
import { EventsModule } from './events/events.module';
@Module({
  imports: [EventsModule],
  controllers: [AppController, TestController], //TestController추가
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TestMiddleware)
      .forRoutes({ path: 'test/middleware-test/*', method: RequestMethod.GET }); //테스트 미들웨어1
    consumer.apply(TestMiddleware2).forRoutes('test/middleware-test2'); //테스트 미들웨어2
  }
}
