# Data module

## pools

load UniswapV3 Pool's data by graph.

```sh
cd data
yarn install
```

run data loader, we will get `USDC-WETH` pool's swaps data. It will save json files in `./Jsondata`, that could take one or two hour.

```sh
node loadSwaps.js
```

Import json data into mongodb (Maybe we could improve it later with saving data into database directly).

```sh
node json2db.js
```

Now, we've got the swaps data in our database.

## users

Let's cook the data, sort them by address.

```sh
cd ./data/users
node sortByAddress.js
```
