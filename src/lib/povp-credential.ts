import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import { prisma } from "@/lib/prisma";

const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021";
const SCHEMA_UID = process.env.POVP_SCHEMA_UID || "";

export async function issuePOVPCredential(bookingId: string) {
  if (!process.env.POVP_ISSUER_PRIVATE_KEY || !process.env.BASE_RPC_URL || !SCHEMA_UID) {
    console.warn("[POVP] Skipping credential issuance — missing env vars (POVP_ISSUER_PRIVATE_KEY, BASE_RPC_URL, POVP_SCHEMA_UID)");
    return null;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { expert: { include: { user: true } }, founder: true }
  });

  if (!booking || (booking.totalAmountCents && booking.totalAmountCents > 0)) {
    return null;
  }

  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
  const signer = new ethers.Wallet(process.env.POVP_ISSUER_PRIVATE_KEY, provider);
  const eas = new EAS(EAS_CONTRACT_ADDRESS);
  eas.connect(signer as unknown as ethers.Signer);

  const schemaEncoder = new SchemaEncoder("string expertName, string ngoName, uint256 hours");
  const hours = (booking.endTime.getTime() - booking.startTime.getTime()) / 3600000;

  const encodedData = schemaEncoder.encodeData([
    { name: "expertName", value: booking.expert.user.name || "Unknown", type: "string" },
    { name: "ngoName", value: booking.founder.name || "NGO", type: "string" },
    { name: "hours", value: Math.round(hours), type: "uint256" },
  ]);

  try {
    const tx = await eas.attest({
      schema: SCHEMA_UID,
      data: {
        recipient: "0x0000000000000000000000000000000000000000",
        expirationTime: BigInt(0),
        revocable: true,
        data: encodedData,
      },
    });

    const newAttestationUID = await tx.wait();

    const povp = await prisma.pOVPCredential.create({
      data: {
        expertId: booking.expertId,
        bookingId: booking.id,
        attestationUID: newAttestationUID,
        recipient: booking.founder.name,
        hours: hours
      }
    });

    return povp;
  } catch (error) {
    console.error("[POVP] EAS Attestation failed:", error);
    return null;
  }
}
