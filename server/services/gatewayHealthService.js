/**
 * Gateway Health Service
 *
 * Revive uses this service before retrying a failed payment.
 *
 * For the hackathon/demo:
 * GATEWAY_HEALTH can be controlled from .env
 *
 * GATEWAY_HEALTH=UP
 * GATEWAY_HEALTH=DOWN
 *
 * In a production setup this service can be connected
 * to real gateway health/observability APIs.
 */

const getGatewayHealth = async () => {
  const configuredHealth = String(
    process.env.GATEWAY_HEALTH || "UP"
  ).toUpperCase();

  const isHealthy = configuredHealth === "UP";

  return {
    healthy: isHealthy,
    status: isHealthy ? "UP" : "DOWN",
    gateway: "RAZORPAY_TEST_GATEWAY",
    checkedAt: new Date(),
    reasoning: isHealthy
      ? "Gateway appears healthy. Controlled retry can proceed."
      : "Gateway appears unstable/down. Revive should postpone the retry to avoid repeated payment failures.",
  };
};

const shouldRetryNow = async () => {
  const health = await getGatewayHealth();

  return {
    retryNow: health.healthy,
    health,
  };
};

module.exports = {
  getGatewayHealth,
  shouldRetryNow,
};