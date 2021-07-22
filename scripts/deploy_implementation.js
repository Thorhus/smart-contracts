const hre = require("hardhat");
const { saveContractAddress} = require('./utils')

async function main() {

    await hre.run('compile');

    const ChainportSideBridge = await hre.ethers.getContractFactory('ChainportSideBridge');
    const chainportSideBridge = await ChainportSideBridge.deploy();
    await chainportSideBridge.deployed();
    console.log('New ChainportBSCBridge implementation: ', chainportSideBridge.address);
    saveContractAddress(hre.network.name, 'ChainportSideBridge', chainportSideBridge.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
