const { expect } = require("chai");
const { ethers } = require("hardhat");
const { signatoryAddress, generateSignature, createHashMint } = require("./testHelpers");

describe("Side Bridge Test", () => {

    let maintainersRegistry, maintainersRegistryInstance, sideBridge, sideBridgeInstance, validator, validatorInstance,
        chainportCongress, maintainer, maintainers, user1, user2, token, contract,
        tokenAmount = 50, nonceIncrease = 1, decimals = 18, tokenAddresses = [], networkId = 2;
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const mintTokens = async () => {
        await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "TestToken", "TT", 18);
        let bridgeTokenAddress = await sideBridgeInstance.originalAssetToBridgeToken(token.address);
        let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens") + nonceIncrease;
        await token.connect(chainportCongress).setSideBridgeContract(sideBridgeInstance.address);
        await sideBridgeInstance.connect(maintainer).mintTokens(
            bridgeTokenAddress, maintainer.address, tokenAmount, lastNonce,
            generateSignature(createHashMint(lastNonce, maintainer.address, tokenAmount, bridgeTokenAddress, networkId)));
        return bridgeTokenAddress;
    }

    beforeEach(async () => {
        maintainersRegistry = await ethers.getContractFactory("MaintainersRegistry");
        [chainportCongress, user1, user2, maintainer, contract, tokenAddresses[0], tokenAddresses[1], tokenAddresses[2],
            tokenAddresses[3], ...maintainers] = await ethers.getSigners();

        token = await ethers.getContractFactory("BridgeMintableToken");
        token = await token.deploy("", "", decimals);

        for(let i = 0; i < tokenAddresses.length; i++) {
            tokenAddresses[i] = tokenAddresses[i].address;
        }

        maintainersRegistryInstance = await maintainersRegistry.deploy();
        for(let i = 0; i < maintainers.length; i++) {
            maintainers[i] = maintainers[i].address;
        }
        maintainers[maintainers.length] = maintainer.address;
        await maintainersRegistryInstance.initialize(maintainers, chainportCongress.address);

        validator = await ethers.getContractFactory("Validator");
        validatorInstance = await validator.deploy();
        sideBridge = await ethers.getContractFactory("ChainportSideBridge");
        sideBridgeInstance = await sideBridge.deploy();
    });

    it("Initialization", async () => {
        await sideBridgeInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);
    });

    describe("Main functions", () => {

        beforeEach(async () => {
            await sideBridgeInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);
            await validatorInstance.initialize(signatoryAddress, chainportCongress.address, maintainersRegistryInstance.address, sideBridgeInstance.address);
            await sideBridgeInstance.connect(chainportCongress).setSignatureValidator(validatorInstance.address);
            await sideBridgeInstance.setOfficialNetworkId(2);
            //await sideBridgeInstance.connect(chainportCongress).setChainportExchange(token.address);
        });

        describe("Setting maintainers registry", () => {
            it("Should set maintainers registry (by congress)", async () => {
                await sideBridgeInstance.connect(chainportCongress).setMaintainersRegistry(contract.address);
            });
            it("Should not set maintainers registry (by user)", async () => {
                await expect(sideBridgeInstance.connect(user1).setMaintainersRegistry(contract.address)).to.be.reverted;
            });
        });

        describe("Bridge Freezing Operations", () => {

            it("Should freeze the bridge (by maintainer)", async () => {
                await sideBridgeInstance.connect(maintainer).freezeBridge();
                expect(await sideBridgeInstance.isFrozen()).to.equal(true);
            });

            it("Should unfreeze the bridge (by congress)", async () => {
                await sideBridgeInstance.connect(maintainer).freezeBridge();
                expect(await sideBridgeInstance.isFrozen()).to.equal(true);
                await sideBridgeInstance.connect(chainportCongress).unfreezeBridge();
                expect(await sideBridgeInstance.isFrozen()).to.equal(false);
            });

            it("Should not let freeze the bridge (by user)", async () => {
                await expect(sideBridgeInstance.connect(user1).freezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should not let unfreeze the bridge (by user)", async () => {
                await sideBridgeInstance.connect(maintainer).freezeBridge();
                expect(await sideBridgeInstance.isFrozen()).to.equal(true);
                await expect(sideBridgeInstance.connect(user1).unfreezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should not unfreeze the bridge (by maintianer)", async () => {
                await sideBridgeInstance.connect(maintainer).freezeBridge();
                expect(await sideBridgeInstance.isFrozen()).to.equal(true);
                await expect(sideBridgeInstance.connect(maintainer).unfreezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Assets freezing operations", () => {

            it("Freeze assets by maintainer", async () => {
                await expect(sideBridgeInstance.connect(maintainer).freezeAssetsByMaintainer(tokenAddresses));
                for(let i; i < tokenAddresses.length; i++){
                    expect(await sideBridgeInstance.isAssetFrozen(tokenAddresses[i])).to.be.true;
                }
            });

            it("Should not freeze asset by user", async () => {
                await expect(sideBridgeInstance.connect(user1).freezeAssetsByMaintainer(tokenAddresses))
                    .to.be.reverted;
            });

            it("Should freeze asset by congress", async () => {
                await expect(sideBridgeInstance.connect(chainportCongress).setAssetFreezeState(token.address, true))
                    .to.emit(sideBridgeInstance, 'AssetFrozen')
                    .withArgs(token.address, true);
            });

            it("Should not unfreeze asset by user or maintainer", async () => {
                await sideBridgeInstance.connect(chainportCongress).setAssetFreezeState(token.address, true);
                await expect(sideBridgeInstance.connect(user1).setAssetFreezeState(token.address, false))
                    .to.be.reverted;
            });

            it("Should unfreeze asset by congress", async () => {
                await expect(sideBridgeInstance.connect(chainportCongress).setAssetFreezeState(token.address, false))
                    .to.emit(sideBridgeInstance, 'AssetFrozen')
                    .withArgs(token.address, false);
            });
        });

        xdescribe("Maintainer work in progress", () => {

            it("Should set maintainer workInProgress by maintainer", async () => {
                await sideBridgeInstance.connect(maintainer).setMaintainerWorkInProgress(true);
                expect(await sideBridgeInstance.maintainerWorkInProgress()).to.be.true;
            });

            it("Should not set maintainer workInProgress by user", async () => {
                await expect(sideBridgeInstance.connect(user1).setMaintainerWorkInProgress(true))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });
        });

        describe("Network activation", () => {

            it("Should activate network (as maintainer)", async () => {
                await sideBridgeInstance.connect(maintainer).activateNetwork(1);
                expect(await sideBridgeInstance.isNetworkActive(1)).to.be.true;
            });

            it("Should not activate network (as user)", async () => {
                await expect(sideBridgeInstance.connect(user1).activateNetwork(1))
                    .to.be.revertedWith('ChainportUpgradables: Restricted only to Maintainer');
            });
            it("Should deactivate network (as congress)", async () => {
                await sideBridgeInstance.connect(maintainer).activateNetwork(1);
                expect(await sideBridgeInstance.isNetworkActive(1)).to.be.true;
                await sideBridgeInstance.connect(chainportCongress).setNetworkActivityState(1, false);
                expect(await sideBridgeInstance.isNetworkActive(1)).to.be.false;
            });

            it("Should not deactivate network (as user)", async () => {
                await sideBridgeInstance.connect(maintainer).activateNetwork(1);
                expect(await sideBridgeInstance.isNetworkActive(1)).to.be.true;
                await expect(sideBridgeInstance.connect(user1).setNetworkActivityState(1, false))
                    .to.be.revertedWith('ChainportUpgradables: Restricted only to ChainportCongress');
            });
        });

        describe("Token Minting", () => {

            it("Should mint a new token (by maintainer)", async () => {
                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);
            });

            it("Should not mint same token second time", async () => {
                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);
                await expect(sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals))
                    .to.be.revertedWith("Error: Token already exists.");
            });

            it("Should not mint a new token (by user)", async () => {
                await expect(sideBridgeInstance.connect(user1).mintNewToken(token.address, "", "", decimals))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should not mint a new token when bridge is frozen", async () => {
                await sideBridgeInstance.connect(maintainer).freezeBridge();
                expect(await sideBridgeInstance.isFrozen()).to.equal(true);
                await expect(sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals))
                    .to.be.revertedWith("Error: All Bridge actions are currently frozen.");
            });

            it("Should not change the bridge contract address (by user)", async () => {
                expect(await token.sideBridgeContract()).to.equal(chainportCongress.address);
                await expect(token.connect(user1).setSideBridgeContract(maintainer.address)).to.be.reverted;
            });

            it("Should change the bridge contract address", async () => {
                expect(await token.sideBridgeContract()).to.equal(chainportCongress.address);
                await token.connect(chainportCongress).setSideBridgeContract(sideBridgeInstance.address);
                expect(await token.sideBridgeContract()).to.equal(sideBridgeInstance.address);
            });

            it("Should mint tokens", async () => {
                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "TestToken", "TT", 18);
                let bridgeToken = await sideBridgeInstance.originalAssetToBridgeToken(token.address);
                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens") + nonceIncrease;
                await token.connect(chainportCongress).setSideBridgeContract(sideBridgeInstance.address);
                await sideBridgeInstance.connect(maintainer).mintTokens(
                    bridgeToken, user1.address, tokenAmount, lastNonce,
                    generateSignature(createHashMint(lastNonce, user1.address, tokenAmount, bridgeToken, networkId)));
            });

            it("Should not mint tokens (by user)", async () => {
                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "TestToken", "TT", 18);
                let bridgeToken = await sideBridgeInstance.originalAssetToBridgeToken(token.address);
                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens") + nonceIncrease;
                await token.connect(chainportCongress).setSideBridgeContract(sideBridgeInstance.address);
                await expect(sideBridgeInstance.connect(user1).mintTokens(
                    bridgeToken, user1.address, tokenAmount, lastNonce,
                    generateSignature(createHashMint(lastNonce, user1.address, tokenAmount, bridgeToken, networkId))
                )).to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should not mint tokens with already used nonce", async () => {
                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "TestToken", "TT", 18);
                let bridgeToken = await sideBridgeInstance.originalAssetToBridgeToken(token.address);
                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens") + nonceIncrease;
                sideBridgeInstance.connect(maintainer).mintTokens(
                    bridgeToken, user1.address, tokenAmount, lastNonce,
                    generateSignature(createHashMint(lastNonce, user1.address, tokenAmount, bridgeToken, networkId))
                )
                await expect(sideBridgeInstance.connect(maintainer).mintTokens(
                    bridgeToken, user1.address, tokenAmount, lastNonce,
                    generateSignature(createHashMint(lastNonce, user1.address, tokenAmount, bridgeToken, networkId))
                )).to.be.revertedWith('Error: Nonce already used.');
            });

            it("Should not mint tokens when amount is below or equal to zero", async () => {
                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "TestToken", "TT", 18);
                let bridgeToken = await sideBridgeInstance.originalAssetToBridgeToken(token.address);
                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens") + nonceIncrease;
                await expect(sideBridgeInstance.connect(maintainer).mintTokens(
                    bridgeToken, user1.address, 0, lastNonce,
                    generateSignature(createHashMint(lastNonce, user1.address, 0, bridgeToken, networkId))
                )).to.be.revertedWith("Amount is not greater than zero.");
            });

            it("Should not mint tokens when bridge is frozen", async () => {
                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "TestToken", "TT", 18);
                let bridgeToken = await sideBridgeInstance.originalAssetToBridgeToken(token.address);
                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens") + nonceIncrease;

                await sideBridgeInstance.connect(maintainer).freezeBridge();
                expect(await sideBridgeInstance.isFrozen()).to.equal(true);

                await expect(sideBridgeInstance.connect(maintainer).mintTokens(
                    bridgeToken, user1.address, tokenAmount, lastNonce,
                    generateSignature(createHashMint(lastNonce, user1.address, tokenAmount, bridgeToken, networkId))
                )).to.be.revertedWith("Error: All Bridge actions are currently frozen.");
            });
        });

        describe("Token Burning", () => {

            it("Should burn a token made by the bridge (by maintainer)", async () => {
                let bridgeTokenAddress = await mintTokens();
                let bridgeToken = await ethers.getContractAt("BridgeMintableToken", bridgeTokenAddress);

                await bridgeToken.connect(maintainer).approve(sideBridgeInstance.address, tokenAmount);
                await sideBridgeInstance.connect(maintainer).burnTokens(bridgeTokenAddress, 1);
                expect(await bridgeToken.balanceOf(maintainer.address)).to.equal(tokenAmount - 1);
            });

            it("Should not burn a token if amount exceeds allowance", async () => {
                let bridgeTokenAddress = await mintTokens();
                await expect(sideBridgeInstance.connect(maintainer).burnTokens(bridgeTokenAddress, 1))
                    .to.be.revertedWith("ERC20: burn amount exceeds allowance");
            });

            it("Should not burn a token if amount is below or equal to zero", async () => {
                let bridgeTokenAddress = await mintTokens();
                await expect(sideBridgeInstance.connect(maintainer).burnTokens(bridgeTokenAddress, 0))
                    .to.be.revertedWith("Amount is not greater than zero.");
            });

            it("Should not burn a token which was not created by the bridge", async () => {
                await expect(sideBridgeInstance.connect(maintainer).burnTokens(
                    await sideBridgeInstance.originalAssetToBridgeToken(token.address), 1))
                    .to.be.revertedWith("Error: Token is not created by the bridge.");
            });
        });

        describe("Cross chain transfer", () => {

            it("Should perform cross chain transfer", async () => {
                let bridgeTokenAddress = await mintTokens();
                let bridgeToken = await ethers.getContractAt("BridgeMintableToken", bridgeTokenAddress);
                await bridgeToken.connect(maintainer).approve(sideBridgeInstance.address, tokenAmount);

                await sideBridgeInstance.connect(maintainer).activateNetwork(1);
                await expect(sideBridgeInstance.connect(maintainer).crossChainTransfer(bridgeTokenAddress, tokenAmount-1, 1))
                    .to.emit(sideBridgeInstance, 'TokensTransferred')
                    .withArgs(bridgeTokenAddress, maintainer.address, tokenAmount-1, 1);
            });

            it("Should not perform cross chain transfer (network not activated)", async () => {
                await expect(sideBridgeInstance.connect(user1).crossChainTransfer(token.address, tokenAmount-1, 1))
                    .to.be.revertedWith("Error: Network with this id is not supported.");
            });

            it("Should not perform cross chain transfer (Token not created by the bridge)", async () => {
                await sideBridgeInstance.connect(maintainer).activateNetwork(1);
                await expect(sideBridgeInstance.connect(user1).crossChainTransfer(token.address, tokenAmount-1, 1))
                    .to.be.revertedWith("Error: Token is not created by the bridge.");
            });

            it("Should not perform cross chain transfer (Token amount 0)", async () => {
                await sideBridgeInstance.connect(maintainer).activateNetwork(1);
                await expect(sideBridgeInstance.connect(user1).crossChainTransfer(token.address, 0, 1))
                    .to.be.revertedWith('Error: Amount is not greater than zero.');
            });

            it("Should not perform cross chain transfer (Token amount exceeds allowance)", async () => {
                let bridgeTokenAddress = await mintTokens();
                await sideBridgeInstance.connect(maintainer).activateNetwork(1);
                await expect(sideBridgeInstance.connect(maintainer).crossChainTransfer(bridgeTokenAddress, tokenAmount+1, 1))
                    .to.be.revertedWith('ERC20: burn amount exceeds allowance');
            });
        });

        describe("Path Pause Flow", () => {

            it("Should pause path by maintainer", async () => {
                await sideBridgeInstance.connect(maintainer).setPathPauseState(token.address, "crossChainTransfer", true);
                expect(await sideBridgeInstance.isPathPaused(token.address, "crossChainTransfer")).to.be.true;
            });

            it("Should not perform function when funnel is paused", async () => {

                let bridgeTokenAddress = await mintTokens();

                await sideBridgeInstance.connect(maintainer).activateNetwork(1);

                await sideBridgeInstance.connect(maintainer).setPathPauseState(bridgeTokenAddress, "crossChainTransfer", true);
                expect(await sideBridgeInstance.isPathPaused(bridgeTokenAddress, "crossChainTransfer")).to.be.true;

                await expect(sideBridgeInstance.connect(maintainer).crossChainTransfer(bridgeTokenAddress, tokenAmount-1, 1))
                    .to.be.revertedWith("Error: Path is paused.");
            });

            it("Should not pause path by user", async () => {
                await expect(sideBridgeInstance.connect(user1).setPathPauseState(token.address, "crossChainTransfer", true))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
                expect(await sideBridgeInstance.isPathPaused(token.address, "crossChainTransfer")).to.be.false;
            });

            it("Should unpause funnel by maintainer", async () => {
                await sideBridgeInstance.connect(maintainer).setPathPauseState(token.address, "crossChainTransfer", true);
                expect(await sideBridgeInstance.isPathPaused(token.address, "crossChainTransfer")).to.be.true;
                await sideBridgeInstance.connect(maintainer).setPathPauseState(token.address, "crossChainTransfer", false);
                expect(await sideBridgeInstance.isPathPaused(token.address, "crossChainTransfer")).to.be.false;
            });

            it("Should not unpause path by user", async () => {
                await sideBridgeInstance.connect(maintainer).setPathPauseState(token.address, "crossChainTransfer", true);
                expect(await sideBridgeInstance.isPathPaused(token.address, "crossChainTransfer")).to.be.true;
                await expect(sideBridgeInstance.connect(user1).setPathPauseState(token.address, "crossChainTransfer", false))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
                expect(await sideBridgeInstance.isPathPaused(token.address, "crossChainTransfer")).to.be.true;
            });
        });
    });
});
