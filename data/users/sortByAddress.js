const { MongoClient } = require("mongodb");
const fs = require("fs");

// Replace the uri string with your MongoDB deployment's connection string.
const uri = "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);

let swaps, users; // db.collection

async function swapsForEach(processFunc) {
  // We better use Cursor instead of using Promise.
  // And can't use Cursor.forEach() because async/await could not work

  const counts = await swaps.count();
  let skipIndex = 0;
  const batchSize = 1000;

  do {
    console.log(
      `loop from ${skipIndex * batchSize} to ${(skipIndex + 1) * batchSize}`
    );
    const _swapsCursor = await swaps
      .find({})
      .skip(skipIndex * batchSize)
      .limit(batchSize);

    let promises = [];
    do {
      const row = Object.assign({}, await _swapsCursor.next());
      // console.log(`name of the ${N}th row: ${row.id}`);
      if (typeof processFunc === "function") {
        promises.push(
          new Promise(async (resovle) => {
            await processFunc(row);
            resovle(true);
          })
        );
      }
    } while (await _swapsCursor.hasNext());
    await Promise.all(promises);

    await _swapsCursor.close();
    skipIndex++;
  } while (skipIndex * batchSize < counts);
}

async function sortByAddress() {
  await swapsForEach(async function (row) {
    const { id, origin, amount0, amount1, amountUSD, sqrtPriceX96 } = row;
    const _trade = {
      id,
      amount0: parseFloat(amount0),
      amount1: parseFloat(amount1),
      amountUSD: parseFloat(amountUSD),
      sqrtPriceX96: parseInt(sqrtPriceX96),
    };
    const odlUser = await users.findOne({ _id: origin });
    if (odlUser) {
      let isInArray = false;
      for (let i = 0; i < odlUser.swaps.length; i++) {
        if (id === odlUser.swaps[i].id) {
          isInArray = true;
          break;
        }
      }
      if (!isInArray) {
        await users.updateOne(
          { _id: origin },
          {
            $push: {
              swaps: _trade,
            },
          }
        );
      }
    } else {
      await users
        .insertOne({
          _id: origin,
          address: origin,
          swaps: [_trade],
        })
        .catch(async (err) => {
          // if insert error, try update
          await users.updateOne(
            { _id: origin },
            {
              $push: {
                swaps: _trade,
              },
            }
          );
        });
    }
  });
}

async function main() {
  try {
    await client.connect();
    const database = client.db("UniV3");
    swaps = database.collection("swaps");
    users = database.collection("users");

    await sortByAddress();
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
