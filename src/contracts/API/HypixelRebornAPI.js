const HypixelAPIReborn = require("hypixel-api-reborn");
const config = require("../../../config.json");

function createClient(apiKey) {
  return new HypixelAPIReborn.Client(apiKey, {
    cache: true
  });
}

let client = createClient(config.minecraft.API.hypixelAPIkey);

// Proxy so every existing caller keeps a stable reference while the underlying
// client can be swapped out at runtime (e.g. after a key rotation) without a restart.
const target = {
  reinitialize(apiKey) {
    client = createClient(apiKey);
  }
};

const hypixel = new Proxy(target, {
  get(obj, prop, receiver) {
    if (prop in obj) {
      return Reflect.get(obj, prop, receiver);
    }

    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  }
});

module.exports = hypixel;
