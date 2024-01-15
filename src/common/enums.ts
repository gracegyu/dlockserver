export const eErrorCode = Object.freeze({
  SUCCESS: 0,
  CANT_CONNECT_REDIS_SERVER: -101,
  UNKNOWN_COMMAND: -102,
  AUTHENTICATION_FIAIL: -103,
  FAILED_TAKELOCK: -104,
  CANT_FIND_LOCK: -105,
  LOCK_EXIST: -106,
  FAILED_ACQUIRE_LOCK: -107,
  FAILED_UNLOCK: -108,
  ERROR_PERMISSION: -109,
  FAILED_WATCH_LOCK: -110,
  FAILED_UNWATCH_LOCK: -111,
});

export const eHttpStatus = Object.freeze({
  OK: 200,
  Created: 201,
  Deleted: 204,
  BadRequest: 400,
  AuthenticationFailure: 401,
  AuthorizationFailure: 403,
  NotFound: 404,
  NotAcceptable: 406,
  Conflict: 409,
  UnprocessableEntity: 422,
  ServiceUnavailable: 503,
});

export function getErrorMessage(errCode: number): string {
  switch (errCode) {
    case eErrorCode.SUCCESS:
      return '성공';
    case eErrorCode.CANT_CONNECT_REDIS_SERVER:
      return "Can't connect to Redis server";
    case eErrorCode.UNKNOWN_COMMAND:
      return '알수 없는 command입니다.';
    case eErrorCode.FAILED_TAKELOCK:
      return 'lock 뺏어오기에 실패했습니다.';
    case eErrorCode.CANT_FIND_LOCK:
      return "Can't find the lock";
    case eErrorCode.LOCK_EXIST:
      return '이미 lock이 있습니다.';
    case eErrorCode.FAILED_ACQUIRE_LOCK:
      return 'lock 획득에 실패했습니다.';
    case eErrorCode.FAILED_UNLOCK:
      return 'lock 해제에 실패했습니다.';
    case eErrorCode.ERROR_PERMISSION:
      return 'You do not have permission.';
    case eErrorCode.FAILED_WATCH_LOCK:
      return 'Lock 감시 시작에 실패했습니다.';
    case eErrorCode.FAILED_UNWATCH_LOCK:
      return 'Lock 감시 해제에 실패했습니다.';
  }
}
