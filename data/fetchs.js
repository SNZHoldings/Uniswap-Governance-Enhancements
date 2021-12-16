const axios = require("axios");
const { UniswapV3GraphUrl } = require("./constants");

function fetchData(_query) {
  return axios
    .post(UniswapV3GraphUrl, {
      query: _query,
    })
    .then(res => {
      if (res.data && res.data.data)
        return res.data.data;
      if (res.data && res.data.errors) {
        console.error(`fetchData error: `, JSON.stringify(res.data.errors))
        return null
      }
      return null
    })
}

function batchFetchData(queryCreator, times = 1, limit = 5) {
  let promises = [];
  for (let i = 0; i < times; i++) {
    const _query = queryCreator(i * limit, limit);
    promises.push(fetchData(_query));
  }
  return promises;
}

function batchFetchDataSync(queryCreator, times, limit) {
  const promises = batchFetchData(queryCreator, times, limit);
  return Promise.all(promises);
}

module.exports = {
  fetchData,
  batchFetchData,
  batchFetchDataSync,
};
