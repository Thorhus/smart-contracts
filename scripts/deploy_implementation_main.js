const hre = require("hardhat");
const { saveContractAddress} = require('./utils')

async function main() {

    await hre.run('compile');

    const ChainportMainBridge = await hre.ethers.getContractFactory('ChainportMainBridge');
    const chainportMainBridge = await ChainportMainBridge.deploy();
    await chainportMainBridge.deployed();
    console.log('New ChainportMainBridge implementation: ', chainportMainBridge.address);
    saveContractAddress(hre.network.name, 'ChainportMainBridge', chainportMainBridge.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
