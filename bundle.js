const { searcherClient } = require("jito-ts/dist/sdk/block-engine/searcher");
const {
  dotenv,
  bs58,
  colors,
  connection,
  owner,
  PROGRAMIDS,
  addLookupTableInfo,

  xWeiAmount,
  xReadableAmount,
  getWalletSOLBalance,
  customSendAndConfirmTransactions,
  customSendPriorityTransactions,
  getWalletTokenBalance,
  BUNDLR_URL,
  NET_URL,
  sleep,
  getWalletTokenAccount,
  BN,
} = require("./global");
const { PublicKey } = require("@solana/web3.js");
const { Bundle } = require("jito-ts/dist/sdk/block-engine/types.js");
const {
  getKeypairFromEnvironment,
} = require("@solana-developers/node-helpers");

const createAndSendBundleTransaction = async (bundleTransactions, payer) => {
  try {
    const BUNDLE_TIP = !process.env.JITO_BUNDLE_TIP
      ? 100000
      : Number(process.env.JITO_BUNDLE_TIP);
    const seacher = searcherClient(
      process.env.JITO_BLOCK_ENGINE_URL,
      getKeypairFromEnvironment("JITO_AUTH_KEY")
    );
    const _tipAccount = (await seacher.getTipAccounts())[0];
    const tipAccount = new PublicKey(_tipAccount);

    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    let bundleTx = new Bundle(bundleTransactions, 5);
    bundleTx.addTipTx(payer, BUNDLE_TIP, tipAccount, recentBlockhash);

    seacher.onBundleResult(
      (bundleResult) => {
        if (bundleResult.accepted) {
          console.log(
            `Bundle ${bundleResult.bundleId} accepted in slot ${bundleResult.accepted.slot}`
          );
        }

        if (bundleResult.rejected) {
          console.log(
            bundleResult.rejected,
            `Bundle ${bundleResult.bundleId} rejected:`
          );
        }
        console.log("=============================");
        console.log("Bundle Result:");
        console.log(bundleResult);
        console.log("=============================");
      },
      (error) => {
        console.log("Error with bundle: ", error);
      }
    );

    const bundleUUID = await seacher.sendBundle(bundleTx);
    console.log("Bundle sent.");
    console.log("Bundle UUID:", bundleUUID);
  } catch (error) {
    console.error("Error creating and sending bundle...", error);
  }
};

module.exports = {
  createAndSendBundleTransaction,
};
