const { PublicKey, Keypair } = require("@solana/web3.js");
const {
  dotenv,
  bs58,
  colors,
  connection,
  owner,
  xWeiAmount,
  xReadableAmount,
  getWalletSOLBalance,
  getWalletTokenBalance,
  BUNDLR_URL,
  NET_URL,
  sleep,
} = require("./global");
const {
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} = require("@solana/spl-token");
const {
  getKeypairFromEnvironment,
} = require("@solana-developers/node-helpers");

const mintTokenTo = async () => {
  console.log("Minting tokens to...".blue);
  if (!process.env.MINT_ADDRESS) {
    console.log("Please set your token address!!".red);
    return;
  }
  const mint = new PublicKey(process.env.MINT_ADDRESS);
  let mintInfo = await getMint(connection, mint);

  for (let i = 1; i <= 30; i++) {
    if (
      !process.env[`MINTTO_ADDRESS${i}`] ||
      !process.env[`MINTTO_AMOUNT${i}`]
    ) {
      if (i === 1) {
        console.log("Please set minto addresses and mintto amounts!!!".red);
      }
      return;
    }

    const walletMint = new PublicKey(process.env[`MINTTO_ADDRESS${i}`]);

    const walletAca = await getOrCreateAssociatedTokenAccount(
      connection,
      owner,
      mint,
      walletMint
    );

    const tokenAmount = xWeiAmount(
      Number(process.env[`MINTTO_AMOUNT${i}`]),
      mintInfo.decimals
    );

    await mintTo(
      connection,
      owner,
      mint,
      walletAca.address,
      owner,
      tokenAmount
    );

    mintInfo = await getMint(connection, mint);
    const supply = xReadableAmount(mintInfo.supply, mintInfo.decimals);

    console.log("Total supply: ".blue, supply.toString());

    const walletTokenAmount = await getWalletTokenBalance(
      process.env[`MINTTO_ADDRESS${i}`],
      new PublicKey(process.env.MINT_ADDRESS),
      mintInfo.decimals
    );

    console.log(
      "Wallet Balance: ".blue,
      process.env[`MINTTO_ADDRESS${i}`],
      walletTokenAmount.toString()
    );
  }
};

mintTokenTo();
