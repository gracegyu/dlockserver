import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { winstonLogger } from './common/winston.util';
import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
  });
  app.useWebSocketAdapter(new WsAdapter(app));

  await app.listen(parseInt(process.env.WEBPORT) ?? 80);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
