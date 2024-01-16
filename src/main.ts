import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import 'dotenv/config';
import { InfoLog } from './common/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));

  await app.listen(parseInt(process.env.WEBPORT) ?? 80);
  console.log(`Application is running on: ${await app.getUrl()}`);
  InfoLog(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
