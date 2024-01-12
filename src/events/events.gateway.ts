import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Server } from 'ws';

@WebSocketGateway(8001)
export class EventsGateway /* implements OnGatewayConnection, OnGatewayDisconnect */ {
  client: Record<string, any>;
  constructor() {
    this.client = {};
  }
  @WebSocketServer()
  server: Server;

  public handleConnection(client): void {
    client['id'] = String(Number(new Date()));
    client['nickname'] = '낯선남자' + String(Number(new Date()));
    this.client[client['id']] = client;
    console.log('hi', client['nickname']);
  }

  public handleDisconnect(client): void {
    console.log('bye', client['id']);
    delete this.client[client['id']];
  }

  @SubscribeMessage('command')
  onCommand(client: any, data: any): Observable<WsResponse<number>> {
    console.log('onCommand', data);
    return from([1, 2, 3]).pipe(
      map((item) => ({ event: 'command', data: item })),
    );
  }
}
