const hre = require("hardhat");
const { getSavedContractAddresses, saveContractAddress , getSavedContractProxies, getSavedContractProxyAbis } = require('./utils');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    await hre.run('compile');
    const contractName = 'ChainportBridgeBsc';
    const proxyAdminAbi = getSavedContractProxyAbis()["ProxyAdmin"];
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
