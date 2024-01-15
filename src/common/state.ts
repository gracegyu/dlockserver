import { Socket } from 'socket.io';

class StateManage {
  // wsId:ws 저장
  private wsList: Map<string, Socket> = new Map();

  // client 별로 lock한 lockKey를 저장
  // takelock할 때 lock 소유자를 찾기 위해서 사용한다.
  // wsId:[lockKey, ...] 저장
  private lockList: Map<string, Set<string>> = new Map();

  // lock 별로 watch 하고 있는 client(wsId) 보관
  // lockKey:[wsId, ...] 저장
  private watchList: Map<string, Set<string>> = new Map();

  // takelock 정보 보관
  // takelock 루틴 완료 될 때까지 일시적으로 발생했다가 사라짐
  // lockKey:wsId 저장
  private takeLockList: Map<string, object> = new Map();

  // 현재 연결된 client 개수
  get numConnections(): number {
    return this.wsList.size;
  }

  // 현재 생성된 lock의 개수
  get numLocks(): number {
    return this.lockList.size;
  }

  // watch 하고 있는 lock 개수
  get numWatchs(): number {
    return this.watchList.size;
  }

  // Client 연결 처리
  connected(wsId: string, ws: Socket): void {
    this.wsList.set(wsId, ws);
    this.lockList.set(wsId, new Set());
    console.log('connected', this.wsList.keys());
  }

  // Client 연결 종료 처리
  disconnected(wsId: string): void {
    this.wsList.delete(wsId);
    this.lockList.delete(wsId);
    this.disconnectedWatch(wsId);
    console.log('disconnected', this.wsList.keys());
  }

  // wsId에 해당하는 wc 얻기
  getWs(wsId: string): Socket {
    console.log('getWs', wsId, this.wsList.keys());
    return this.wsList.get(wsId);
  }

  // lock 생성 처리
  lock(wsId: string, lockKey: string): void {
    if (this.lockList.get(wsId) == null) {
      this.lockList.set(wsId, new Set());
    }
    this.lockList.get(wsId).add(lockKey);
  }

  // lock 해제 처리
  unlock(wsId: string, lockKey: string): void {
    this.lockList.get(wsId).delete(lockKey);
  }

  // lock owner 정보 (wsId)
  lockOwner(lockKey: string): string {
    let wsIdOwner: string = null;
    console.log('this.lockList', this.lockList);
    this.lockList.forEach((lockKeyList, wsId) => {
      console.log('lockKeyList', lockKeyList);
      if (lockKeyList.has(lockKey)) {
        wsIdOwner = wsId;
        return wsId;
      }
    });
    console.log('lockOwner:wsId:', wsIdOwner);
    return wsIdOwner;
  }

  // wsId 클라이언트가 생성한 lock 목록
  listOfLock(wsId: string): Set<string> {
    return this.lockList.get(wsId);
  }

  // lockKey의 lock을 watch하고 있는 client(wsId) 목록
  getWatchList(lockKey: string): Set<string> {
    return this.watchList.get(lockKey);
  }

  // lock watch 처리
  watchLock(lockKey: string, wsId: string): void {
    console.log('watchLock', lockKey, wsId);

    if (!lockKey || !wsId) return;
    console.log(
      '1 this.watchList.get(lockKey)',
      lockKey,
      this.watchList.get(lockKey),
    );
    if (this.watchList.get(lockKey) == null) {
      this.watchList.set(lockKey, new Set());
      console.log(
        '2 this.watchList.get(lockKey)',
        lockKey,
        this.watchList.get(lockKey),
      );
    }
    this.watchList.get(lockKey).add(wsId);
    console.log(
      '3 this.watchList.get(lockKey)',
      lockKey,
      this.watchList.get(lockKey),
    );

    console.log('this.watchList', this.watchList);
  }

  // lock watch 해제 처리
  unwatchLock(lockKey: string, wsId: string): void {
    console.log('unwatchLock', lockKey, wsId);
    console.log('unwatchLock 1 this.watchList', this.watchList);

    if (!lockKey || !wsId) return;
    this.watchList.get(lockKey).delete(wsId);
    console.log(
      'unwatchLock 1.1 this.watchList.get(lockKey)',
      lockKey,
      this.watchList.get(lockKey),
    );

    if (this.watchList.get(lockKey).size == 0) {
      // 비었음
      console.log('unwatchLock 비었음', lockKey);
      this.watchList.delete(lockKey);
    }
    console.log('unwatchLock 2 this.watchList', this.watchList);
  }

  // 해당 lock watch를 모두 제거
  clearWatchLock(lockKey: string): void {
    console.log('clearWatchLock', lockKey);
    this.watchList.delete(lockKey);
  }

  // client가 연결을 종료할 때 해당 client가 watch하고 있는 모든 lock을 제거한다.
  disconnectedWatch(wsId: string): void {
    console.log('disconnectedWatch', wsId);
    console.log('disconnectedWatch 1 this.watchList', this.watchList);
    const emptyList: Array<string> = [];

    this.watchList.forEach((wsIdList, lockKey) => {
      console.log('disconnectedWatch', lockKey, wsIdList);
      wsIdList.delete(wsId);
      if (wsIdList.size == 0) emptyList.push(lockKey);
    });

    emptyList.forEach((lockKey) => {
      console.log('disconnectedWatch 비었음', lockKey);
      this.watchList.delete(lockKey);
    });

    console.log('disconnectedWatch 2 this.watchList', this.watchList);
  }

  // lock 뺏어가기 client 등록
  addTakeLock(
    lockKey: string,
    wsId: string,
    ttl: number,
    userId: string,
    userName: string,
    takeId: string,
  ): void {
    const obj: object = { wsId, ttl, userId, userName, takeId };

    this.takeLockList.set(lockKey, obj);
    console.log('addTakeLock', lockKey, this.takeLockList);
  }

  // lockKey의 lock을 현재 뺏어가기 등록한 client 정보
  getTakeLock(lockKey: string): object {
    console.log('getTakeLock', lockKey, this.takeLockList);
    return this.takeLockList.get(lockKey);
  }

  // lock뺏어가기 관련 정보 삭제
  deleteTakeLock(lockKey: string): void {
    this.takeLockList.delete(lockKey);
    console.log('deleteTakeLock', lockKey, this.takeLockList);
  }
}

export const state: StateManage = new StateManage();
