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
  const batchSize = 100;

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
    const { id, origin } = row;
    const odlUser = await users.findOne({ _id: origin });
    if (odlUser) {
      if (odlUser.swaps.join(",").indexOf(`${id}`) < 0) {
        await users.updateOne(
          { _id: origin },
          {
            $push: {
              swaps: id,
            },
          }
        );
      }
    } else {
      await users
        .insertOne({
          _id: origin,
          address: origin,
          swaps: [id],
        })
        .catch(async (err) => {
          // if insert error, try update
          await users.updateOne(
            { _id: origin },
            {
              $push: {
                swaps: id,
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
