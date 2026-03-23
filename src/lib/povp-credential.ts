import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import { prisma } from "@/lib/prisma";

const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021"; // Base/Optimism typical EAS address
const SCHEMA_UID = process.env.POVP_SCHEMA_UID || "0x0000000000000000000000000000000000000000000000000000000000000000";

export async function issuePOVPCredential(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { expert: { include: { user: true } }, founder: true }
  });

  // Only issue credentials for completed free sessions (pro-bono volunteering)
  if (!booking || (booking.totalAmountCents && booking.totalAmountCents > 0)) {
    return null; 
  }

  // Initialize EAS provider
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || "https://mainnet.base.org");
  const signer = new ethers.Wallet(process.env.POVP_ISSUER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001", provider);
  const eas = new EAS(EAS_CONTRACT_ADDRESS);
  eas.connect(signer as unknown as ethers.Signer);

  // Encode the volunteer data
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
        recipient: "0x0000000000000000000000000000000000000000", // Would be expert's EVM wallet if stored
        // @ts-expect-error Next config enforces ES2019 without BigInt
        expirationTime: 0n,
        revocable: true,
        data: encodedData,
      },
    });

    const newAttestationUID = await tx.wait();

    // Save proof to database
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
