/**
 * POMP (Proof of Meet) schema for Ethereum Attestation Service (EAS).
 * Register once per chain via scripts/register-pomp-eas-schema.mjs or Base EASScan UI,
 * then set POMP_EAS_SCHEMA_UID to the returned schema UID.
 */
export const POMP_EAS_SCHEMA =
  "bytes32 sessionHash,string expertId,string menteeId,string topic,string recipientRole";
