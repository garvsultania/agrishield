'use strict';

// Uses @stellar/stellar-sdk (v12+) — NOT the legacy stellar-sdk package
const StellarSdk = require('@stellar/stellar-sdk');
const { Keypair, Networks, TransactionBuilder, Operation, Asset, Memo, BASE_FEE, Horizon } = StellarSdk;
const axios = require('axios');
const crypto = require('crypto');

const FRIENDBOT_URL = 'https://friendbot.stellar.org/?addr=';
const TESTNET_HORIZON = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

let _cachedKeypair = null;

/**
 * Load or auto-generate a funded testnet keypair.
 * If STELLAR_ADMIN_SECRET_KEY is set in env, use it.
 * Otherwise, generate a new keypair and fund it via Friendbot.
 * NEVER hardcodes any keys.
 */
async function getAdminKeypair() {
  if (_cachedKeypair) return _cachedKeypair;

  const secretKey = process.env.STELLAR_ADMIN_SECRET_KEY;

  if (secretKey) {
    console.log('[stellarService] Using keypair from STELLAR_ADMIN_SECRET_KEY env var');
    _cachedKeypair = Keypair.fromSecret(secretKey);
    return _cachedKeypair;
  }

  // Auto-generate and fund a testnet keypair so the demo works with zero setup
  console.log('[stellarService] No STELLAR_ADMIN_SECRET_KEY found — generating and funding a new testnet keypair via Friendbot');
  const newKeypair = Keypair.random();

  try {
    const friendbotUrl = `${FRIENDBOT_URL}${newKeypair.publicKey()}`;
    await axios.get(friendbotUrl, { timeout: 15000 });
    console.log(`[stellarService] Funded new testnet account: ${newKeypair.publicKey()}`);
    console.log(`[stellarService] To reuse this keypair, set STELLAR_ADMIN_SECRET_KEY=${newKeypair.secret()}`);
  } catch (err) {
    console.warn(`[stellarService] Friendbot funding failed: ${err.message}. Proceeding anyway.`);
  }

  _cachedKeypair = newKeypair;
  return _cachedKeypair;
}

/**
 * Trigger a payout for a farm.
 *
 * If SOROBAN_CONTRACT_ID is set, attempts to invoke the Soroban smart contract's
 * trigger_payout function. Otherwise submits a simple XLM payment on testnet
 * as a proof-of-concept.
 *
 * @param {string} farmId - Farm identifier
 * @param {string} recipientAddress - Stellar public key of recipient
 * @param {string} proofHash - SHA-256 hash of proof-of-loss data
 * @returns {Promise<{ txHash: string, explorerUrl: string, method: string }>}
 */
async function triggerPayout(farmId, recipientAddress, proofHash) {
  const contractId = process.env.SOROBAN_CONTRACT_ID;

  if (contractId) {
    return await triggerPayoutViaContract(farmId, recipientAddress, proofHash, contractId);
  }

  return await triggerPayoutViaPayment(farmId, recipientAddress, proofHash);
}

/**
 * Submit a simple XLM payment as proof-of-concept when no Soroban contract is deployed.
 * Sends 1 XLM to the recipient with a memo containing the farmId + proofHash.
 */
async function triggerPayoutViaPayment(farmId, recipientAddress, proofHash) {
  const adminKeypair = await getAdminKeypair();
  const server = new Horizon.Server(TESTNET_HORIZON);

  // Load account from Horizon
  let account;
  try {
    account = await server.loadAccount(adminKeypair.publicKey());
  } catch (err) {
    throw new Error(`Failed to load Stellar account: ${err.message}`);
  }

  // Ensure recipient account exists on testnet; if not, fund via friendbot
  try {
    await server.loadAccount(recipientAddress);
  } catch {
    console.log(`[stellarService] Recipient ${recipientAddress} not found, attempting friendbot funding...`);
    try {
      await axios.get(`${FRIENDBOT_URL}${recipientAddress}`, { timeout: 10000 });
    } catch (fbErr) {
      console.warn(`[stellarService] Friendbot for recipient failed: ${fbErr.message}`);
    }
  }

  // Memo: "AGRI-{farmId}" truncated to 28 chars (Stellar memo limit)
  const memoText = `AGRI-${farmId}`.slice(0, 28);

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE
  })
    .addOperation(
      Operation.payment({
        destination: recipientAddress,
        asset: Asset.native(),
        amount: '1' // 1 XLM as proof-of-concept payout
      })
    )
    .addMemo(Memo.text(memoText))
    .setTimeout(30)
    .build();

  transaction.sign(adminKeypair);

  let result;
  try {
    result = await server.submitTransaction(transaction);
  } catch (err) {
    const detail = err.response?.data?.extras?.result_codes || err.message;
    throw new Error(`Stellar transaction failed: ${JSON.stringify(detail)}`);
  }

  const txHash = result.hash;
  const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${txHash}`;

  return { txHash, explorerUrl, method: 'xlm-payment' };
}

/**
 * Invoke the Soroban smart contract's trigger_payout function.
 * Requires SOROBAN_CONTRACT_ID to be set.
 *
 * NOTE: Full Soroban contract invocation requires soroban-client or
 * @stellar/stellar-sdk v11+ with Soroban support. This implementation
 * uses the RPC-based invocation pattern.
 */
async function triggerPayoutViaContract(farmId, recipientAddress, proofHash, contractId) {
  const adminKeypair = await getAdminKeypair();

  const sorobanRpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';

  try {
    // stellar-sdk v13+ uses `rpc` namespace (was `SorobanRpc` in v12)
    const { rpc, Contract, nativeToScVal } = StellarSdk;
    const rpcServer = new rpc.Server(sorobanRpcUrl);
    const contract = new Contract(contractId);

    const account = await rpcServer.getAccount(adminKeypair.publicKey());

    // Symbol: max 32 chars, [a-zA-Z0-9_]. Truncate proof hash to fit.
    const farmIdScVal = nativeToScVal(farmId, { type: 'symbol' });
    const recipientScVal = nativeToScVal(recipientAddress, { type: 'address' });
    const proofHashScVal = nativeToScVal(proofHash.slice(0, 32), { type: 'symbol' });

    const tx = new TransactionBuilder(account, {
      fee: '1000000',
      networkPassphrase: NETWORK_PASSPHRASE
    })
      .addOperation(contract.call('trigger_payout', farmIdScVal, recipientScVal, proofHashScVal))
      .setTimeout(30)
      .build();

    const preparedTx = await rpcServer.prepareTransaction(tx);
    preparedTx.sign(adminKeypair);

    const sendResult = await rpcServer.sendTransaction(preparedTx);
    if (sendResult.status === 'ERROR') {
      throw new Error(`sendTransaction rejected: ${JSON.stringify(sendResult.errorResult?.result()?.switch()?.name || sendResult)}`);
    }
    const txHash = sendResult.hash;

    // Poll RPC for terminal status
    let getResult;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      getResult = await rpcServer.getTransaction(txHash);
      if (getResult.status === 'SUCCESS' || getResult.status === 'FAILED') break;
    }

    if (getResult && getResult.status === 'FAILED') {
      throw new Error(`Contract invocation failed on-chain: ${JSON.stringify(getResult.resultXdr || '')}`);
    }

    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${txHash}`;
    return { txHash, explorerUrl, method: 'soroban-contract' };
  } catch (err) {
    console.warn(`[stellarService] Soroban contract invocation failed: ${err.message}. Falling back to XLM payment.`);
    return await triggerPayoutViaPayment(farmId, recipientAddress, proofHash);
  }
}

/**
 * Generate a SHA-256 proof hash from proof-of-loss data.
 * @param {object} proofData - The proof_of_loss object from oracleLogic
 * @param {string} farmId
 * @returns {string} hex-encoded SHA-256 hash
 */
function generateProofHash(proofData, farmId) {
  const payload = JSON.stringify({ farmId, ...proofData, timestamp: Date.now() });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Fetch transaction status from Stellar Horizon testnet.
 * @param {string} txHash - Transaction hash
 * @returns {Promise<{ status: string, ledger: number|null, timestamp: string|null }>}
 */
async function getTransactionStatus(txHash) {
  const server = new Horizon.Server(TESTNET_HORIZON);

  try {
    const tx = await server.transactions().transaction(txHash).call();
    return {
      status: tx.successful ? 'success' : 'failed',
      ledger: tx.ledger,
      timestamp: tx.created_at,
      fee_charged: tx.fee_charged
    };
  } catch (err) {
    if (err.response?.status === 404) {
      return { status: 'not_found', ledger: null, timestamp: null };
    }
    throw new Error(`Failed to fetch transaction: ${err.message}`);
  }
}

module.exports = { triggerPayout, getTransactionStatus, getAdminKeypair, generateProofHash };
