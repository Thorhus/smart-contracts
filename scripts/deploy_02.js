const hre = require("hardhat");
const { hexify, toChainportDenomination } = require('../test/setup');
const { getSavedContractAddresses, saveContractAddress, getSavedContractBytecodes, saveContractBytecode } = require('./utils')
let c = require('../deployments/deploymentConfig.json');

async function main() {
    await hre.run('compile');
    const config = c[hre.network.name];
    const contracts = getSavedContractAddresses()[hre.network.name];

    const signatoryAddressTest = '0xD86FC51cAbe595162f1398ffdcDb7E4f69C54078';

    const MaintainersRegistry = await ethers.getContractFactory('MaintainersRegistry')
    const maintainersRegistry = await upgrades.deployProxy(MaintainersRegistry, [config.maintainers, contracts.ChainportCongress]);
    await maintainersRegistry.deployed()
    console.log('MaintainersRegistry Proxy deployed to:', maintainersRegistry.address);


    // Deploy call library
    const Call = await hre.ethers.getContractFactory('Call');
    const call = await Call.deploy();
    await call.deployed();

    const Validator = await ethers.getContractFactory('Validator');
    const validator = await upgrades.deployProxy(
        Validator, [
            signatoryAddressTest,
            maintainersRegistry.address,
            contracts.ChainportCongress
        ]
    );
    await validator.deployed()
    console.log('Validator Proxy deployed to:', validator.address);


    const ChainportBridgeEth = await ethers.getContractFactory('ChainportBridgeEth')
    const chainportBridgeEth = await upgrades.deployProxy(ChainportBridgeEth,[
        maintainersRegistry.address,
        contracts.ChainportCongress,
        validator.address,
        config.timeLockLength, // 3600 secs timelock
        config.safetyThreshold // safety threshold 20%
    ]);
    await chainportBridgeEth.deployed()
    console.log("ChainportBridgeEth contract deployed to:", chainportBridgeEth.address);

    let admin = await upgrades.admin.getInstance();

    let maintainersImplementation = await admin.getProxyImplementation(maintainersRegistry.address);
    console.log('Maintainers Implementation: ', maintainersImplementation);
    saveContractAddress(hre.network.name, 'MaintainersRegistry', maintainersImplementation);

    let validatorImplementation = await admin.getProxyImplementation(validator.address)
    console.log('Validator Implementation: ', validatorImplementation);
    saveContractAddress(hre.network.name, 'Validator', validatorImplementation)

    let bridgeImplementation = await admin.getProxyImplementation(chainportBridgeEth.address);
    console.log('Bridge Implementation: ', bridgeImplementation);
    saveContractAddress(hre.network.name, 'ChainportBridgeEth', bridgeImplementation);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
