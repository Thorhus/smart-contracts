const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress , getSavedContractProxies, saveContractProxies } = require('./utils');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const proxyAdminAbi = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[{"internalType":"contract TransparentUpgradeableProxy","name":"proxy","type":"address"},{"internalType":"address","name":"newAdmin","type":"address"}],"name":"changeProxyAdmin","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract TransparentUpgradeableProxy","name":"proxy","type":"address"}],"name":"getProxyAdmin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"contract TransparentUpgradeableProxy","name":"proxy","type":"address"}],"name":"getProxyImplementation","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract TransparentUpgradeableProxy","name":"proxy","type":"address"},{"internalType":"address","name":"implementation","type":"address"}],"name":"upgrade","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract TransparentUpgradeableProxy","name":"proxy","type":"address"},{"internalType":"address","name":"implementation","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"upgradeAndCall","outputs":[],"stateMutability":"payable","type":"function"}];

async function main() {
    await hre.run('compile');
    const contractName = 'ChainportBridgeEth';
    const proxyAddress = getSavedContractProxies()[hre.network.name][contractName];
    const oldImplementation = getSavedContractAddresses()[hre.network.name][contractName];

    console.log("Upgrading proxy...");
    const contract = await ethers.getContractFactory(contractName);
    const deployment = await contract.deploy();
    await deployment.deployed();

    let admin = await hre.ethers.getContractAt(proxyAdminAbi, getSavedContractProxies()[hre.network.name]["ProxyAdmin"]);
    const proxy = await admin.upgrade(proxyAddress, deployment.address);

    let implementation = oldImplementation;
    console.log("Proxy upgraded.");

    console.log("Waiting for a new block...");

    while(implementation === oldImplementation){
        await sleep(5000);
        implementation = await admin.getProxyImplementation(proxyAddress);
        console.log("Still waiting...")
    }

    console.log("Block arrived.");

    console.log("Implementation changed successfully: " + '\n' + oldImplementation + " -> " + implementation);
    console.log('New implementation is: ', implementation);
    saveContractAddress(hre.network.name, contractName, implementation);
    console.log("Upgrade complete!")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
