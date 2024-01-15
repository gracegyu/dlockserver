import 'dotenv/config';
import { Socket } from 'socket.io';
import { createCluster, createClient } from 'redis';
import { state } from '../common/state';
import { flakeGen } from '../common/flakeId';
// import type { RedisClientType } from 'redis';
import { getErrorMessage, eErrorCode } from '../common/enums';

const serverURL = process.env.REDIS_SERVER_URL || 'localhost:6379';
const serverList = process.env.REDIS_CLUSTER_LIST;
// import { Logger } from '@nestjs/common';
import { logger } from '../common/logger';

class RedisServer {
  // private logger = new Logger('RedisServer');
  private logger = logger;
  server: any = null;
  serverError: string = null;
  isCluster: boolean = serverList != null;

  constructor() {
    this.logger.info('constructor');
    this.initialize();
  }

  async initialize() {
    this.logger.info('initialize');
    await this.connectServer();
    await this.runLockListener();
  }

  async connectServer(): Promise<void> {
    this.logger.info('connectServer');
    if (this.isCluster) {
      this.logger.info('Cluster mode');
      console.log('serverList', serverList);
      const clusterList = eval(serverList);
      const rootNodes = [];
      clusterList.forEach((element) => {
        console.log('element', element);
        rootNodes.push({ url: 'redis://' + element });
      });
      console.log('rootNodes', rootNodes);

      this.server = createCluster({
        rootNodes: rootNodes,
      });
    } else {
      this.logger.info('not Cluster mode');
      console.log('Redis serverURL', serverURL);
      this.server = createClient({
        url: 'redis://' + serverURL,
      });
    }
    this.server.on('error', (err) => {
      console.log('Redis Client Error', err);
      this.serverError = err.toString();
    });

    await this.server.connect();
  }

  async runLockListener(): Promise<void> {
    this.logger.info('runLockListener');
    const subscriber = this.server.duplicate();
    subscriber.on('error', (err: any) => console.error(err));
    await subscriber.connect();
    const client: any = subscriber;

    await client.subscribe('lockChannel', this.listener.bind(this));
    // await client.pSubscribe('lockChannel', this.listener.bind(this));
    // Use sSubscribe for sharded Pub/Sub:
    // await client.sSubscribe('lockChannel', this.listener.bind(this));

    await client.subscribe('awayChannel', this.listener.bind(this));

    await client.subscribe('unlockChannel', this.listener.bind(this));
    await client.subscribe('acceptwayChannel', this.listener.bind(this));
    // await client.pSubscribe('unlockChannel', this.listener.bind(this));
    // Use sSubscribe for sharded Pub/Sub:
    // await client.sSubscribe('unlockChannel', this.listener.bind(this));

    // key expired 알림을 하기 위해서는...
    // await client.subscribe('__key*__:*', this.listener.bind(this));
    await client.pSubscribe('__key*__:*', this.listener.bind(this));
    // AWS에서는 아래 sSubscribe를 해야 한다.
    await client.sSubscribe('__key*__:*', this.listener.bind(this));
  }

  listener(message: string, channel: string): void {
    this.logger.info('listener', message, channel);

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self: any = this;

    console.log('lockListener:', channel, ' | ', message);
    if (channel == '__keyevent@0__:expired') {
      self.parseExpiredChannel(message);
      return;
    }

    let obj: object = null;
    try {
      obj = JSON.parse(message);
    } catch (err) {
      console.log('Ignore system event:', channel);
      return;
    }

    switch (channel) {
      case 'lockChannel':
        self.parseLockChannel(obj);
        break;
      case 'awayChannel':
        self.parseAwayChannel(obj);
        break;
      case 'unlockChannel':
        self.parseUnlockChannel(obj);
        break;
      case 'acceptwayChannel':
        self.parseAcceptAwayChannel(obj);
        break;
      default:
        console.log('Unknown channel:', channel);
        break;
    }
  }

  parseLockChannel(obj: object): void {
    const lockKey = obj['lockKey'];
    console.log('parseLockChannel:', lockKey);

    const response = {
      type: 'noti',
      notiCode: 'locked',
      lockKey: lockKey,
      result: {
        wsId: obj['wsId'],
        userId: obj['userId'],
        userName: obj['userName'],
        timestamp: obj['timestamp'],
      },
    };

    console.log(
      'state.getWatchList(lockKey)',
      lockKey,
      state.getWatchList(lockKey),
    );
    if (state.getWatchList(lockKey)) {
      for (const wsId of state.getWatchList(lockKey)) {
        console.log('wsId', wsId);
        const ws = state.getWs(wsId);
        if (ws != null) {
          this.wsSend(ws, response);
        } else {
          console.log('ws is null ???????????????');
        }
      }
    }
  }

  parseAwayChannel(obj: object): void {
    const lockKey = obj['lockKey'];
    const wsId = obj['wsId']; // lock을 뺏어가려는 client
    console.log('parseAwayChannel:', lockKey, wsId);

    // lock 소유자를 찾아서 awaylock noti를 보낸다.
    const wsIdOwner = state.lockOwner(lockKey);

    if (wsIdOwner) {
      // Lock owner를 찾았다.
      const ws = state.getWs(wsIdOwner);
      if (ws) {
        this.wsSend(ws, {
          type: 'noti',
          notiCode: 'awaylock',
          lockKey: lockKey,
        });
      } else {
        // 비정상 상태, wsIdOwner가 현재 이 서버에 연결되지 않았다.
        throw '비정상 상태, wsIdOwner가 현재 이 서버에 연결되지 않았다.';
      }
    } else {
      // lock owner를 찾지 못했다. 아마 다른 lock서버에 연결된듯
      // 아무 처리도 하지 않는다.
    }
  }

  parseUnlockChannel(obj: object): void {
    const lockKey = obj['lockKey'];
    const wsId = obj['wsId'];
    console.log('parseUnlockChannel:', lockKey);
    const response = {
      type: 'noti',
      notiCode: 'unlocked',
      lockKey,
      wsId,
    };

    console.log(
      'state.getWatchList(lockKey)',
      lockKey,
      state.getWatchList(lockKey),
    );
    if (state.getWatchList(lockKey)) {
      for (const wsId of state.getWatchList(lockKey)) {
        console.log('wsId', wsId);
        const ws = state.getWs(wsId);
        if (ws != null) {
          this.wsSend(ws, response);
        }
      }
    }
  }

  async parseAcceptAwayChannel(obj: object): Promise<void> {
    console.log('parseAcceptAwayChannel:', obj);
    const lockKey = obj['lockKey'];
    console.log('parseAcceptAwayChannel:', lockKey);

    // takelock을 시도한 client를 찾는다.
    const lockObj = state.getTakeLock(lockKey);
    console.log('lockObj', lockObj);
    if (lockObj) {
      const wsId = lockObj['wsId'];
      const ttl = parseInt(lockObj['ttl']);
      const userId = lockObj['userId'];
      const userName = lockObj['userName'];
      const ws = state.getWs(wsId);

      if (ws) {
        const lockId = flakeGen();
        const timestamp = Date.now();
        if (
          await this.takeLockKey(
            wsId,
            lockKey,
            ttl,
            lockId,
            userId,
            userName,
            timestamp,
          )
        ) {
          console.log('takeLockKey 성공');
          const responseCode = eErrorCode.SUCCESS;
          this.wsSend(ws, {
            type: 'response',
            command: 'takelock',
            responseCode: responseCode,
            message: getErrorMessage(responseCode),
            lockKey,
            lockId,
            timestamp,
          });
          // 이 client(wsId)가 생성한 lockList에 lockKey를 저장한다.
          state.lock(wsId, lockKey);
        } else {
          console.log('takeLockKey 실패');
          const responseCode = eErrorCode.FAILED_TAKELOCK;
          this.wsSend(ws, {
            type: 'response',
            command: 'takelock',
            responseCode: responseCode,
            message: getErrorMessage(responseCode),
            lockKey,
          });
        }
      }
    } else {
      // takelock을 시도한 client를 찾지 못했으므로 무시한다.
      // 아마 다른 lock서버에서 찾을 수 있음
      console.log(
        'parseAcceptAwayChannel',
        lockKey,
        'takelock을 시도한 client를 찾지 못했으므로 무시한다.',
      );
    }
    state.deleteTakeLock(lockKey);
  }

  parseExpiredChannel(lockKey: string): void {
    console.log('parseExpiredChannel:', lockKey);
    const response = {
      type: 'noti',
      notiCode: 'expired',
      lockKey: lockKey,
      // TODO
    };

    console.log(
      'state.getWatchList(lockKey)',
      lockKey,
      state.getWatchList(lockKey),
    );
    if (state.getWatchList(lockKey)) {
      for (const wsId of state.getWatchList(lockKey)) {
        console.log('wsId', wsId);
        const ws = state.getWs(wsId);
        if (ws != null) {
          this.wsSend(ws, response);
        }
      }
    }
  }

  wsSend(ws: Socket, obj: object): void {
    try {
      ws.send(JSON.stringify(obj));
    } catch (error) {
      console.log('wsSend error:', error);
    }
  }

  async lockKey(
    wsId: string,
    lockKey: string,
    ttl: number,
    lockId: string,
    userId: string,
    userName: string,
    timestamp: number,
  ): Promise<any> {
    console.log(
      'lockKey',
      JSON.stringify({ wsId, lockId, userId, userName, timestamp }),
    );

    const ret = await this.server.set(
      lockKey,
      JSON.stringify({ wsId, lockId, userId, userName, timestamp }),
      {
        EX: ttl,
        NX: true,
      },
    );

    if (ret) {
      // lock에 성공하면 lock noti를 보낸다.
      const message = {
        wsId,
        lockKey,
        lockId,
        userId,
        userName,
        timestamp,
      };

      this.server.publish('lockChannel', JSON.stringify(message));
    }
    return ret;
  }

  async publishAwayLock(wsId: string, lockKey: string): Promise<void> {
    this.logger.info('publishAwayLock', wsId, lockKey);

    const message = {
      wsId,
      lockKey,
    };

    this.server.publish('awayChannel', JSON.stringify(message));
  }

  async takeLockKey(
    wsId: string,
    lockKey: string,
    ttl: number,
    lockId: string,
    userId: string,
    userName: string,
    timestamp: number,
  ): Promise<any> {
    console.log(
      'takeLockKey',
      JSON.stringify({ wsId, lockId, userId, userName, timestamp }),
    );

    const ret = await this.server.set(
      lockKey,
      JSON.stringify({ wsId, lockId, userId, userName, timestamp }),
      {
        EX: ttl,
        NX: false,
      },
    );
    console.log('ret', ret);
    if (ret) {
      // lock에 성공하면 lock noti를 보낸다.
      const message = {
        wsId,
        lockKey,
        lockId,
        userId,
        userName,
        timestamp,
      };

      this.server.publish('lockChannel', JSON.stringify(message));
      console.log('server.publish', 'lockChannel', message);
    }
    return ret;
  }

  async unlockKey(wsId: string, lockKey: string): Promise<void> {
    this.logger.info('unlockKey', wsId, lockKey);
    console.log('unlockKey', wsId, lockKey);
    this.server.del(lockKey);
    const message = {
      wsId,
      lockKey,
    };
    this.server.publish('unlockChannel', JSON.stringify(message));
  }

  async getLockKey(lockKey: string): Promise<string> {
    console.log('getLockKey', lockKey);
    const val = await this.server.get(lockKey);

    this.logger.info(`getLockKey(${lockKey}) => ${val}`);
    return val;
  }

  test(): string {
    console.log('RedisServer.test()');
    return 'test';
  }
}

export const redisServer = new RedisServer();
