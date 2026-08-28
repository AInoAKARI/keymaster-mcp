export function requireFacilitatorSettlement(settlementResponse, expectedNetwork) {
  if (!settlementResponse || settlementResponse.success !== true) throw new Error(settlementResponse?.errorReason || 'facilitator did not report settlement success');
  if (typeof settlementResponse.transaction !== 'string' || settlementResponse.transaction.length < 8) throw new Error('facilitator settlement missing transaction');
  if (settlementResponse.network !== expectedNetwork) throw new Error('facilitator settlement network mismatch');
  return settlementResponse.transaction;
}

function confirmed(status) {
  return Boolean(status && status.err == null && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized'));
}

export async function collectExternalSettlementEvidence({
  phase,
  settlementResponse,
  expectedNetwork,
  expectedAmountAtomic,
  receiverTokenAccount,
  beforeReceiverBalanceAtomic,
  rpc
}) {
  if (!rpc?.getSignatureStatus) throw new Error('solana rpc client required');
  const transaction = requireFacilitatorSettlement(settlementResponse, expectedNetwork);
  const status = await rpc.getSignatureStatus(transaction);
  if (!confirmed(status)) {
    return { externalTxVerified: false, settled: false, phase, transaction, network: expectedNetwork, reason: 'transaction_not_confirmed' };
  }

  const base = {
    externalTxVerified: true,
    settled: false,
    phase,
    transaction,
    network: expectedNetwork,
    confirmationStatus: status.confirmationStatus
  };

  if (phase !== 'distribute') {
    return { ...base, reason: phase === 'deposit' ? 'channel_funded_not_receiver_settled' : 'receiver_settlement_not_proven' };
  }

  if (!rpc.getTokenAccountBalance || !receiverTokenAccount || beforeReceiverBalanceAtomic == null) {
    return { ...base, reason: 'receiver_balance_evidence_missing' };
  }

  const before = BigInt(beforeReceiverBalanceAtomic);
  const after = await rpc.getTokenAccountBalance(receiverTokenAccount);
  const delta = after - before;
  const expected = BigInt(expectedAmountAtomic ?? 0);
  const settled = delta > 0n && delta >= expected;
  return {
    ...base,
    settled,
    receiverTokenAccount,
    receiverBalanceBeforeAtomic: before.toString(),
    receiverBalanceAfterAtomic: after.toString(),
    receiverBalanceDeltaAtomic: delta.toString(),
    expectedAmountAtomic: expected.toString(),
    reason: settled ? null : 'receiver_balance_delta_below_expected'
  };
}

export function toRealityLedgerSettlement(evidence) {
  if (!evidence?.settled) {
    return {
      settled: false,
      cashDelta: 0,
      externalTransaction: evidence?.transaction ?? null,
      reason: evidence?.reason ?? 'external_settlement_not_proven'
    };
  }
  return {
    settled: true,
    cashDelta: 0,
    asset: 'USDC',
    network: evidence.network,
    externalTransaction: evidence.transaction,
    receiverBalanceDeltaAtomic: evidence.receiverBalanceDeltaAtomic,
    evidenceClass: 'external_tx_plus_receiver_balance_delta'
  };
}
