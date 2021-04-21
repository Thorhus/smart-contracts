const { ethers } = require("ethers");

var wallet = ethers.Wallet.createRandom();

console.log("Public: " + wallet.address);
console.log("Private: " + wallet.privateKey);

