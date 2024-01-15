import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  // WsResponse,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

import 'dotenv/config';
import { Server } from 'ws';
import { flakeGen } from '../common/flakeId';
import { redisServer } from './redisServer';
import { state } from '../common/state';
import { getErrorMessage, eErrorCode } from '../common/enums';
// import { Logger } from '@nestjs/common';
import { logger } from '../common/logger';

const DEBUG: boolean = false;
const DEFAULT_TTL: number = 3600;
const DEFAULT_RETRYCOUNT: number = 10;
const DEFAULT_RETRYDELAY: number = 100;

console.log('flakeGen', flakeGen());
console.log('server.test()', redisServer.test());

@WebSocketGateway(parseInt(process.env.WSPORT) ?? 8001)
export class EventsGateway /* implements OnGatewayConnection, OnGatewayDisconnect */ {
  // private logger = new Logger('WebSocketGateway');
  private logger = logger;
  constructor() {
    this.logger.info(`constructor`);
    console.log('EventsGateway instance');
  }
  @WebSocketServer()
  server: Server;

  // Client가 Server에 접속하면 호출
  public handleConnection(@ConnectedSocket() client: Socket): void {
    const wsId: string = flakeGen();
    this.logger.info(`handleConnection ${wsId}`);
    client['wsId'] = wsId;
    state.connected(wsId, client);
    console.log('handleConnection', typeof client, wsId);
  }

  // Client가 연결을 종료할 때 호출
  public handleDisconnect(@ConnectedSocket() client: Socket): void {
    const wsId: string = client['wsId'];
    this.logger.info(`handleDisconnect ${wsId}`);
    state.disconnected(wsId);
  }

  @SubscribeMessage('command')
  onCommand(client: Socket, data: object): void {
    const wsId: string = client['wsId'];
    this.logger.info(`onCommand ${wsId} ${JSON.stringify(data)}`);
    console.log('onCommand', wsId, data);
    this.parseMessage(wsId, client, data);
  }

  parseMessage(wsId: string, ws: Socket, message: object): void {
    console.log('parseMessage', wsId, message);
    const obj: object = message;
    const command: string = obj['command'];
    if (!command) {
      this.wsSendUnknownCommand(wsId, ws, 'null');
      return;
    }
    if (redisServer.serverError != null) {
      this.wsSendServerError(wsId, ws, command);
      return;
    }

    switch (command) {
      case 'lock':
        this.commandLock(wsId, ws, obj);
        break;
      case 'takelock':
        this.commandTakeLock(wsId, ws, obj);
        break;
      case 'acceptaway':
        this.commandAcceptAway(wsId, ws, obj);
        break;
      case 'unlock':
        this.commandUnlock(wsId, ws, obj);
        break;
      case 'restorelock':
        this.commandRestoreLock(wsId, ws, obj);
        break;
      case 'clearlock':
        this.commandClearLock(wsId, ws, obj);
        break;
      case 'watchlock':
        this.commandWatchLock(wsId, ws, obj);
        break;
      case 'unwatchlock':
        this.commandUnwatchLock(wsId, ws, obj);
        break;
      default:
        this.commandUnknown(wsId, ws, obj);
        break;
    }
  }

  wsSend(ws: Socket, obj: object): void {
    try {
      ws.send(JSON.stringify(obj));
    } catch (error) {
      console.log('wsSend error:', error);
    }
  }

  wsSendUnknownCommand(wsId: string, ws: Socket, command: string): void {
    this.logger.info(`wsSendUnknownCommand ${wsId}`);

    const responseCode: number = eErrorCode.UNKNOWN_COMMAND;

    this.wsSend(ws, {
      type: 'response',
      responseCode: responseCode,
      message: getErrorMessage(responseCode) + ` (${command})`,
    });
  }

  wsSendServerError(wsId: string, ws: Socket, command: string): void {
    this.logger.info(`wsSendServerError ${wsId} ${command}`);
    const responseCode: number = eErrorCode.CANT_CONNECT_REDIS_SERVER;
    this.wsSend(ws, {
      type: 'response',
      command,
      responseCode: responseCode,
      message: getErrorMessage(responseCode),
    });
  }

  wsSendNowFound(wsId: string, ws: Socket, command: string): void {
    this.logger.info('wsSendNowFound', wsId, command);
    const responseCode: number = eErrorCode.CANT_FIND_LOCK;
    this.wsSend(ws, {
      type: 'response',
      command,
      responseCode: responseCode,
      message: getErrorMessage(responseCode),
    });
  }

  wsSendNotOwner(wsId: string, ws: Socket, command: string): void {
    this.logger.info('wsSendNotOwner', wsId, command);
    const responseCode: number = eErrorCode.ERROR_PERMISSION;
    this.wsSend(ws, {
      type: 'response',
      command,
      responseCode: responseCode,
      message: getErrorMessage(responseCode),
    });
  }

  async commandLock(wsId: string, ws: Socket, obj: object): Promise<void> {
    console.log('commandLock', obj);
    const lockKey: string = obj['lockKey'];
    const ttl: number = obj['ttl'] ?? DEFAULT_TTL;
    const retryCount: number = obj['retryCount'] ?? DEFAULT_RETRYCOUNT;
    const retryDelay: number = obj['retryDelay'] ?? DEFAULT_RETRYDELAY;
    const userId: string = obj['userId'];
    const userName: string = obj['userName'];
    this.logger.info('commandLock', wsId, lockKey);

    const lockId: string = flakeGen();
    const timestamp: number = Date.now();
    let retry = retryCount;

    try {
      while (true) {
        console.log('redis set', lockKey, JSON.stringify({ lockId: lockId }));

        if (
          await redisServer.lockKey(
            wsId,
            lockKey,
            ttl,
            lockId,
            userId,
            userName,
            timestamp,
          )
        ) {
          const responseCode = eErrorCode.SUCCESS;

          this.wsSend(ws, {
            type: 'response',
            command: 'lock',
            responseCode: responseCode,
            message: getErrorMessage(responseCode),
            lockKey,
            lockId,
            timestamp,
          });
          state.lock(wsId, lockKey);
          console.log('state.listOfLock', wsId, state.listOfLock(wsId));

          return;
        }
        if (retry-- >= 0) {
          await this.delay(retryDelay);
        } else {
          break;
        }
      }
      const responseCode: number = eErrorCode.LOCK_EXIST;
      this.wsSend(ws, {
        type: 'response',
        command: 'lock',
        responseCode: responseCode,
        message: getErrorMessage(responseCode),
        lockKey,
      });

      state.watchLock(lockKey, wsId);
      return;
    } catch (err) {
      console.log('err', err);
      const responseCode: number = eErrorCode.FAILED_ACQUIRE_LOCK;
      this.wsSend(ws, {
        type: 'response',
        command: 'lock',
        responseCode: responseCode,
        message: err.toString(),
        lockKey,
      });

      return;
    }
  }

  async commandTakeLock(wsId: string, ws: Socket, obj: object): Promise<void> {
    console.log('commandTakeLock', obj);
    const lockKey: string = obj['lockKey'];
    const ttl: number = obj['ttl'] ?? DEFAULT_TTL;
    const userId: string = obj['userId'];
    const userName: string = obj['userName'];
    this.logger.info('commandTakeLock', wsId, lockKey);

    try {
      const takeId: string = flakeGen();
      state.addTakeLock(lockKey, wsId, ttl, userId, userName, takeId);
      redisServer.publishAwayLock(wsId, lockKey);
      setTimeout(() => {
        // 3초안에 승인 응답이 없으면 Owner에 문제가 있는 것으로 간주하고 강제로 뻇어온다.
        this.takeLockWithoutAccept(lockKey, takeId);
      }, 3000);
    } catch (err) {
      console.log('err', err);
      const responseCode: number = eErrorCode.FAILED_TAKELOCK;
      this.wsSend(ws, {
        type: 'response',
        command: 'takelock',
        responseCode: responseCode,
        message: err.toString(),
        lockKey,
      });
    }
  }

  async takeLockWithoutAccept(lockKey: string, takeId: string): Promise<void> {
    console.log('takeLockWithoutAccept', lockKey, takeId);
    // takelock을 시도한 client를 찾는다.
    const lockObj: object = state.getTakeLock(lockKey);
    console.log('lockObj', lockObj);
    if (lockObj) {
      if (lockObj['takeId'] == takeId) {
        // 승인이 이루어지지 않았다. 강제로 그냥 가져온다.
        redisServer.parseAcceptAwayChannel({ lockKey: lockKey });
      }
    } else {
      console.log('// 이미 승인 받아서 takelock 성공 했다.');
    }
  }

  async commandAcceptAway(
    wsId: string,
    ws: Socket,
    obj: object,
  ): Promise<void> {
    console.log('commandAcceptAway', obj);
    const lockKey: string = obj['lockKey'];
    this.logger.info('commandAcceptAway', wsId, lockKey);

    state.unlock(wsId, lockKey);

    const message: object = {
      lockKey,
    };
    redisServer.server.publish('acceptwayChannel', JSON.stringify(message));
  }

  async commandUnlock(wsId: string, ws: Socket, obj: object): Promise<void> {
    console.log('commandUnlock', obj);
    const lockKey: string = obj['lockKey'];
    const lockId: string = obj['lockId'];
    const userId: string = obj['userId'];
    console.log('commandUnlock', lockKey, userId);
    this.logger.info('commandUnlock', wsId, lockKey);

    try {
      const val: string = await redisServer.getLockKey(lockKey);
      if (!val) {
        this.wsSendNowFound(wsId, ws, 'unlock');
        return;
      }

      const obj: object = JSON.parse(val);
      if (DEBUG != true && obj['lockId'] != lockId) {
        this.wsSendNotOwner(wsId, ws, 'unlock');
        return;
      } else {
        const wsId: string = obj['wsId'];
        redisServer.unlockKey(wsId, lockKey);

        this.wsSend(ws, {
          type: 'response',
          command: 'unlock',
          responseCode: eErrorCode.SUCCESS,
          message: 'lock을 해제했습니다.',
          lockKey,
        });
      }
      state.unlock(wsId, lockKey);
      console.log('state.listOfLock', wsId, state.listOfLock(wsId));

      return;
    } catch (err) {
      console.log('err', err);

      this.wsSend(ws, {
        type: 'response',
        command: 'unlock',
        responseCode: eErrorCode.FAILED_UNLOCK,
        message: err.toString(),
        lockKey,
      });

      return;
    }
  }

  async commandRestoreLock(
    wsId: string,
    ws: Socket,
    obj: object,
  ): Promise<void> {
    console.log('commandRestoreLock', obj);
    const lockKey: string = obj['lockKey'];
    const lockId: string = obj['lockId'];
    this.logger.info('commandRestoreLock', wsId, lockKey);

    try {
      const val: string = await redisServer.getLockKey(lockKey);
      if (!val) {
        this.wsSendNowFound(wsId, ws, 'restorelock');
        return;
      }

      const obj: object = JSON.parse(val);
      if (DEBUG != true && obj['lockId'] != lockId) {
        this.wsSendNotOwner(wsId, ws, 'restorelock');
        return;
      } else {
        const wsId: string = obj['wsId'];
        state.lock(wsId, lockKey);

        this.wsSend(ws, {
          type: 'response',
          command: 'restorelock',
          responseCode: eErrorCode.SUCCESS,
          message: 'lock을 복구했습니다.',
          lockKey,
        });
      }
      state.watchLock(lockKey, wsId);
      console.log('state.listOfLock', wsId, state.listOfLock(wsId));

      return;
    } catch (err) {
      console.log('err', err);

      this.wsSend(ws, {
        type: 'response',
        command: 'restorelock',
        responseCode: eErrorCode.FAILED_UNLOCK,
        message: err.toString(),
        lockKey,
      });

      return;
    }
  }

  async commandClearLock(wsId: string, ws: Socket, obj: object): Promise<void> {
    console.log('commandClearLock', obj);
    const lockKey: string = obj['lockKey'];
    this.logger.info('commandClearLock', wsId, lockKey);

    state.lock(wsId, lockKey);
    console.log('state.listOfLock', wsId, state.listOfLock(wsId));
  }

  async commandWatchLock(wsId: string, ws: Socket, obj: object): Promise<void> {
    console.log('commandWatchLock', obj);
    const lockKey: string = obj['lockKey'];
    this.logger.info('commandWatchLock', wsId, lockKey);

    try {
      const val: string = await redisServer.getLockKey(lockKey);
      console.log('getLockKey', lockKey, val);
      const locked: boolean = val != null;
      let result: object = null;
      if (locked) {
        const obj: object = JSON.parse(val);
        result = {
          userId: obj['userId'],
          userName: obj['userName'],
          timestamp: obj['timestamp'],
        };
      }

      const response: object = {
        type: 'response',
        command: 'watchlock',
        responseCode: eErrorCode.SUCCESS,
        message: 'lock을 감시합니다.',
        lockKey,
        locked,
        result,
      };

      this.wsSend(ws, response);

      state.watchLock(lockKey, wsId);

      return;
    } catch (err) {
      console.log('err', err);

      this.wsSend(ws, {
        type: 'response',
        command: 'watchlock',
        responseCode: eErrorCode.FAILED_WATCH_LOCK,
        message: err.toString(),
        lockKey,
      });

      return;
    }
  }

  async commandUnwatchLock(
    wsId: string,
    ws: Socket,
    obj: object,
  ): Promise<void> {
    console.log('commandUnwatchLock', obj);
    const lockKey: string = obj['lockKey'];
    this.logger.info('commandUnwatchLock', wsId, lockKey);

    try {
      const val: string = await redisServer.getLockKey(lockKey);
      let result: object = null;
      if (val) {
        const obj2: object = JSON.parse(val);
        result = {
          userId: obj2['userId'],
          userName: obj2['userName'],
          timestamp: obj2['timestamp'],
        };
      }
      this.wsSend(ws, {
        type: 'response',
        command: 'unwatchlock',
        responseCode: eErrorCode.SUCCESS,
        message: 'lock 감시를 해제합니다.',
        lockKey,
        result,
      });

      state.unwatchLock(lockKey, wsId);

      return;
    } catch (err) {
      console.log('err', err);

      this.wsSend(ws, {
        type: 'response',
        command: 'unwatchlock',
        responseCode: eErrorCode.FAILED_UNWATCH_LOCK,
        message: err.toString(),
        lockKey,
      });

      return;
    }
  }

  async commandUnknown(wsId: string, ws: Socket, obj: object): Promise<void> {
    console.log('commandUnknown', obj);
    const lockKey: string = obj['lockKey'];
    const command: string = obj['command'];
    this.logger.info('commandUnknown', wsId, lockKey);

    const responseCode: number = eErrorCode.UNKNOWN_COMMAND;

    try {
      this.wsSend(ws, {
        type: 'response',
        command,
        responseCode: responseCode,
        message: getErrorMessage(responseCode) + ` (${command})`,
        lockKey,
      });
      return;
    } catch (err) {
      console.log('err', err);

      this.wsSend(ws, {
        type: 'response',
        command,
        responseCode: responseCode,
        message: err.toString(),
        lockKey,
      });

      return;
    }
  }
  delay(t: number): Promise<unknown> {
    return new Promise((resolve) => {
      setTimeout(resolve, t);
    });
  }
}
