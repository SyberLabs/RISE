/**
 * Destination adapters receive an approved package identity and bounded
 * metadata. They never receive the Workshop, acquisition authority, or
 * credentials. The first adapter is a mock so publication can be proven
 * without a social SDK.
 */

export function createMockSocialAdapter({
  id = 'mock-social',
  destinationKind = 'social-short',
  accountIdentity = 'mock:@rise-demo',
  onDeliver = null,
  onWithdraw = null
} = {}) {
  let deliveryCount = 0;
  let withdrawCount = 0;

  return {
    id,
    destinationKind,
    accountIdentity,
    get deliveryCount() {
      return deliveryCount;
    },
    get withdrawCount() {
      return withdrawCount;
    },
    async deliver(request) {
      deliveryCount += 1;
      if (onDeliver) return onDeliver(request);
      const key = request.idempotencyKey;
      return {
        accountIdentity,
        platformPostId: `post-${key}`,
        platformUrl: `https://social.example/posts/${encodeURIComponent(key)}`,
        state: 'published'
      };
    },
    async withdraw(request) {
      withdrawCount += 1;
      if (onWithdraw) return onWithdraw(request);
      return { ok: true };
    }
  };
}
