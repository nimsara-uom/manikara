import { db } from './db';
import { requestInfo } from './request';

export type SecurityEventType =
  | 'REGISTER' | 'EMAIL_VERIFIED'
  | 'SIGN_IN' | 'SIGN_IN_FAILED' | 'SIGN_IN_CODE_SENT' | 'SIGN_IN_RATE_LIMITED'
  | 'OTP_FAILED' | 'OTP_LOCKED'
  | 'PASSWORD_RESET_REQUESTED' | 'PASSWORD_CHANGED'
  | 'SIGN_OUT_ALL' | 'TWO_FACTOR_ENABLED' | 'TWO_FACTOR_DISABLED'
  | 'ADMIN_GEM_SAVED' | 'ADMIN_GEM_DELETED' | 'ADMIN_AUCTION_SAVED';

/** Records a security-relevant event. Never throws: auditing must not break the action itself. */
export async function audit(type: SecurityEventType, userId: string | null, detail?: string) {
  try {
    const { ip, userAgent } = await requestInfo();
    await db.securityEvent.create({ data: { type, userId, ip, userAgent, detail: detail?.slice(0, 500) } });
  } catch (e) {
    console.error('audit failed', type, e);
  }
}
