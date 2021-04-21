const hre = require("hardhat");
const { hexify, toChainportDenomination: toChainportDenomination } = require('../test/setup');
const { getSavedContractAddresses, saveContractAddress, getSavedContractBytecodes, saveContractBytecode } = require('./utils')
const config = require('../deployments/deploymentConfig.json');


// const { ethers, utils } = require('ethers');


async function sendEther(privateKey, to) {
    let provider = ethers.getDefaultProvider();

    // let privateKey = "0x3141592653589793238462643383279502884197169399375105820974944592"
    let wallet = new ethers.Wallet(privateKey, provider);

    let amount = ethers.utils.parseEther('0.1');

    let tx = {
        to: to,
        // ... or supports ENS names
        // to: "ricmoo.firefly.eth",

        // We must pass in the amount as wei (1 ether = 1e18 wei), so we
        // use this convenience function to convert ether to wei.
        value: amount
    };

    let sendPromise = wallet.sendTransaction(tx);

    sendPromise.then((tx) => {
        console.log(tx);
        // {
        //    // All transaction fields will be present
        //    "nonce", "gasLimit", "pasPrice", "to", "value", "data",
        //    "from", "hash", "r", "s", "v"
        // }
    });
}


async function main() {
    await hre.run('compile');

    let accounts = await ethers.getSigners();

    const deploymentNetwork = process.env.HARDHAT_NETWORK;
    if (deploymentNetwork == 'local'){
        let privateKey = precess.env.PK;
        let wallet = new ethers.Wallet(privateKey);


        sendEther(wallet.address);
        console.log(await accounts[0]);
        await accounts[0].getAddress();
    }

    throw new Error('test');

    const ChainportBridgeEth = await hre.ethers.getContractFactory("ChainportBridgeEth");
    const chainportBridgeEth = await ChainportBridgeEth.deploy();
    await chainportBridgeEth.deployed();

    console.log("chainport contract deployed to:", chainportBridgeEth.address);

    saveContractAddress(hre.network.name, 'ChainportBridgeEth', chainportBridgeEth.address);

    console.log(process.env);

    const ercToken = await hre.ethers.getContractFactory("ChainportToken");
    const ercTokenInstance = await ercToken.deploy(
        config.ethErc20tokenName,
        config.ethErc20tokenNameSymbol,
        toChainportDenomination(config.ethErc20tokenNameSupply.toString()),
        chainportCongress.address
    );
    await ercTokenInstance.deployed();

    console.log("ERC20 test token deployed to:", ercTokenInstance.address);

    await chainportCongress.setMembersRegistry(chainportCongressMembersRegistry.address);
    saveContractAddress(hre.network.name, 'ChainportToken', ercTokenInstance.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
