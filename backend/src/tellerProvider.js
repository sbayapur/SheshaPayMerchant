import { randomUUID } from "crypto";

/**
 * Exchange a Teller token for an enrollment.
 * In production, replace this mock with a real Teller API call using your API key.
 */
export async function exchangeTellerToken(tellerToken) {
  if (!tellerToken) {
    throw new Error("tellerToken is required");
  }

  // Mocked enrollment; swap for real Teller exchange
  const enrollmentId = randomUUID();
  return {
    enrollmentId,
    institution: { name: "Mock Bank" },
    accounts: [
      {
        id: `acct-${enrollmentId.slice(0, 8)}`,
        name: "Checking",
        type: "checking",
        last4: "4242",
      },
    ],
    accessToken: `access_${enrollmentId}`,
    linkedAt: new Date().toISOString(),
  };
}

