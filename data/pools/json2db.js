const { MongoClient } = require("mongodb");
const fs = require("fs");

// Replace the uri string with your MongoDB deployment's connection string.
const uri = "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);
async function run() {
  try {
    await client.connect();
    const database = client.db("UniV3");
    const swaps = database.collection("swaps");
    // create an array of documents to insert
    const readDir = fs.readdirSync("./USDC-WETH-500");
    for (let i = 0; i < readDir.length; i++) {
      const _dir = readDir[i];
      if (!/(\S|\s)+\.json/.test(_dir)) continue;
      const data = JSON.parse(
        fs.readFileSync(`./USDC-WETH-500/${_dir}`, { encoding: "utf-8" })
      );
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        await swaps.updateOne(
          { _id: row.id },
          {
            $set: {
              _id: row.id,
              ...row,
            },
          },
          {
            upsert: true,
          }
        );
      }
      console.log(`complete import data: ${_dir}`)
    }
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
