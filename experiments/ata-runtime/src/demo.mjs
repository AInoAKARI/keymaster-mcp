import {
  createAgentServer,
  createCard,
  createDemoSettlement,
  createIdentity,
  hash,
  postEnvelope,
  signEnvelope
} from './runtime.mjs';

const seller = createIdentity('AIﾉアカリ☆ Seller Agent');
const sellerCard = createCard(seller, 'http://127.0.0.1:8788/a2a', ['echo']);
const server = createAgentServer({ identity: seller, card: sellerCard, price: '0.001', skill: 'echo' });

await server.listen(8788);

try {
  const buyer = createIdentity('AIﾉアカリ☆ Buyer Agent');
  const settlement = createDemoSettlement();
  const task = {
    taskId: crypto.randomUUID?.() ?? `${Date.now()}`,
    skill: 'echo',
    input: 'あなたは私、私はあなた。AtA hello.',
    maxBudget: { asset: 'USDC', amount: '0.005', network: 'eip155:84532' }
  };

  const quote = await postEnvelope(
    sellerCard.endpoint,
    signEnvelope(buyer, 'task.advertise', task)
  );

  const requirement = quote.body.paymentRequirement;
  if (Number(requirement.amount) > Number(task.maxBudget.amount)) {
    throw new Error('quote exceeds budget');
  }

  const paymentProof = await settlement.authorize(requirement);
  const award = signEnvelope(buyer, 'task.award', {
    taskId: task.taskId,
    quoteId: quote.body.quoteId,
    termsHash: quote.body.termsHash,
    input: task.input,
    paymentProof
  });

  const receipt = await postEnvelope(sellerCard.endpoint, award);

  console.log(JSON.stringify({
    status: 'COMPLETED',
    buyer: buyer.id,
    seller: seller.id,
    quote: quote.body,
    settlement: receipt.body.settlement,
    output: receipt.body.output,
    receiptHash: hash(receipt.body)
  }, null, 2));
} finally {
  await server.close();
}
