class StateManage {
  // wsId:ws 저장
  wsList: Map<string, any> = new Map();
  // client 별로 lock한 lockKey를 저장
  // takelock할 때 lock 소유자를 찾기 위해서 사용한다.
  // wsId:[lockKey, ...] 저장
  lockList: Map<string, Set<string>> = new Map();
  // lock 별로 watch 하고 있는 client(wsId) 보관
  // lockKey:[wsId, ...] 저장
  watchList: Map<string, Set<string>> = new Map();
  // takelock 정보 보관
  // takelock 루틴 완료 될 때까지 일시적으로 발생했다가 사라짐
  // lockKey:wsId 저장
  takeLockList: Map<string, any> = new Map();

  connected(wsId: string, ws: any): void {
    this.wsList.set(wsId, ws);
    this.lockList.set(wsId, new Set());
    console.log('connected', this.wsList.keys());
  }
  disconnected(wsId: string): void {
    this.wsList.delete(wsId);
    this.lockList.delete(wsId);
    this.disconnectedWatch(wsId);
    console.log('disconnected', this.wsList.keys());
  }
  getWs(wsId: string): object {
    console.log('getWs', wsId, this.wsList.keys());
    return this.wsList.get(wsId);
  }

  lock(wsId: string, lockKey: string): void {
    if (this.lockList.get(wsId) == null) {
      this.lockList.set(wsId, new Set());
    }
    this.lockList.get(wsId).add(lockKey);
  }

  unlock(wsId: string, lockKey: string): void {
    this.lockList.get(wsId).delete(lockKey);
  }

  lockOwner(lockKey: string): string {
    let wsIdOwner = null;
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

  listOfLock(wsId: string): Set<string> {
    return this.lockList.get(wsId);
  }

  getWatchList(lockKey: string): Set<string> {
    return this.watchList.get(lockKey);
  }

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

  clearWatchLock(lockKey: string): void {
    console.log('clearWatchLock', lockKey);
    this.watchList.delete(lockKey);
  }

  disconnectedWatch(wsId: string): void {
    console.log('disconnectedWatch', wsId);
    console.log('disconnectedWatch 1 this.watchList', this.watchList);
    const emptyList = [];

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

  addTakeLock(
    lockKey: string,
    wsId: string,
    ttl: any,
    userId: string,
    userName: string,
    takeId: string,
  ): void {
    const obj = { wsId, ttl, userId, userName, takeId };

    this.takeLockList.set(lockKey, obj);
    console.log('addTakeLock', lockKey, this.takeLockList);
  }

  getTakeLock(lockKey: string): any {
    console.log('getTakeLock', lockKey, this.takeLockList);
    return this.takeLockList.get(lockKey);
  }

  deleteTakeLock(lockKey: string): void {
    this.takeLockList.delete(lockKey);
    console.log('deleteTakeLock', lockKey, this.takeLockList);
  }
}

export const state = new StateManage();
