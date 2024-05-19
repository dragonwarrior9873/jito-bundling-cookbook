const {
  createMint,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} = require("@solana/spl-token");

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
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");

const {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
  toMetaplexFile,
} = require("@metaplex-foundation/js");

const {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID,
} = require("@metaplex-foundation/mpl-token-metadata");

const fs = require("fs");

const mintTotalSupply = async (tokenAddr, totalSupply) => {
  const mint = new PublicKey(tokenAddr);
  let mintInfo = await getMint(connection, mint);

  const ownerTokenAcc = await getOrCreateAssociatedTokenAccount(
    connection,
    owner,
    mint,
    owner.publicKey
  );

  const tokenAmount = xWeiAmount(totalSupply, mintInfo.decimals);
  const mintRes = await mintTo(
    connection,
    owner,
    mint,
    ownerTokenAcc.address,
    owner,
    tokenAmount
  );

  mintInfo = await getMint(connection, mint);
  const supply = xReadableAmount(mintInfo.supply, mintInfo.decimals);

  console.log("Minted supply: ".blue, supply.toString());
};

const createTokenMetaData = async (tokenAddr) => {
  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(owner))
    .use(
      bundlrStorage({
        address: BUNDLR_URL,
        providerUrl: NET_URL,
        timeout: 60000,
      })
    );

  const buffer = fs.readFileSync(process.env.TOKEN_LOGO_PATH);
  const file = toMetaplexFile(buffer, "new_token_logo.png");
  const logoUrl = await metaplex.storage().upload(file);

  console.log("Logo Url: ", logoUrl);

  const metaplexData = {
    name: process.env.TOKEN_NAME,
    symbol: process.env.TOKEN_SYMBOL,
    image: logoUrl,
  };

  let { uri } = await metaplex.nfts().uploadMetadata(metaplexData);

  console.log("Metadata Url: ", uri);

  const mint = new PublicKey(tokenAddr);
  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), PROGRAM_ID.toBuffer(), mint.toBuffer()],
    PROGRAM_ID
  );

  const tokenMetaData = {
    name: process.env.TOKEN_NAME,
    symbol: process.env.TOKEN_SYMBOL,
    uri: uri,
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null,
  };

  const transaction = new Transaction().add(
    createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint: mint,
        mintAuthority: owner.publicKey,
        payer: owner.publicKey,
        updateAuthority: owner.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: tokenMetaData,
          isMutable: true,
          collectionDetails: null,
        },
      }
    )
  );

  const ret = await sendAndConfirmTransaction(connection, transaction, [owner]);

  console.log("Create metaplex result: ", ret);
};

const createToken = async () => {
  if (
    !process.env.TOKEN_NAME ||
    !process.env.TOKEN_SYMBOL ||
    !process.env.TOKEN_DECIMAL ||
    !process.env.TOKEN_SUPPLY ||
    !process.env.TOKEN_LOGO_PATH
  ) {
    console.log("Please set environment variables for token creation!".red);
    return;
  }

  console.log(
    "Creating Token...".blue,
    process.env.TOKEN_NAME,
    process.env.TOKEN_SYMBOL,
    process.env.TOKEN_DECIMAL,
    process.env.TOKEN_SUPPLY,
    process.env.TOKEN_LOGO_PATH
  );

  const tokenMint = await createMint(
    connection,
    owner,
    owner.publicKey,
    owner.publicKey,
    Number(process.env.TOKEN_DECIMAL)
  );

  const tokenMintedAddr = tokenMint.toBase58();
  console.log(
    "===========================================================".yellow
  );
  console.log(`***** Mint Address: ${tokenMintedAddr} *****`);
  console.log(`***** You have to save this value *****`);
  console.log(
    "===========================================================".yellow
  );

  console.log("Creating token meta data...".blue);
  await createTokenMetaData(tokenMintedAddr);

  console.log("Mint token amount of supply to owner wallet...".blue);
  await mintTotalSupply(tokenMintedAddr, Number(process.env.TOKEN_SUPPLY));
};

createToken();

module.exports = {
  createToken,
};
