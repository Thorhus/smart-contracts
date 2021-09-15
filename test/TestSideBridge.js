const { expect } = require("chai");

describe("Side Bridge Test", function () {

    let maintainersRegistry, maintainersRegistryInstance, sideBridge, sideBridgeInstance,
    validator, validatorInstance, chainportCongress, maintainer, maintainers, user1, user2, token, contract,
    tokenAmount = 50, nonceIncrease = 1, decimals = 18, zeroAddress = "0x0000000000000000000000000000000000000000",
    tokenAddresses = [], revertedAddresses = [];

    beforeEach(async function() {
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

    it("Initialization", async function () {
        await sideBridgeInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);
    });

    describe("Main functions", function () {

        beforeEach(async function () {
            await sideBridgeInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);
        });

        describe("Setting maintainers registry", function () {
            it("Should set maintainers registry (by congress)", async function () {
                await sideBridgeInstance.connect(chainportCongress).setMaintainersRegistry(contract.address);
            });
            it("Should not set maintainers registry (by user)", async function () {
                await expect(sideBridgeInstance.connect(user1).setMaintainersRegistry(contract.address)).to.be.reverted;
            });
        });

        describe("Bridge Freezing Operations", function () {

            it("Should freeze the bridge (by maintainer)", async function () {
                await sideBridgeInstance.connect(maintainer).freezeBridge();
                expect(await sideBridgeInstance.isFrozen()).to.equal(true);
            });

            it("Should unfreeze the bridge (by congress)", async function () {
                await sideBridgeInstance.connect(maintainer).freezeBridge();
                expect(await sideBridgeInstance.isFrozen()).to.equal(true);
                await sideBridgeInstance.connect(chainportCongress).unfreezeBridge();
                expect(await sideBridgeInstance.isFrozen()).to.equal(false);
            });

            it("Should not let freeze the bridge (by user)", async function () {
                await expect(sideBridgeInstance.connect(user1).freezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should not let unfreeze the bridge (by user)", async function () {
                await sideBridgeInstance.connect(maintainer).freezeBridge();
                expect(await sideBridgeInstance.isFrozen()).to.equal(true);
                await expect(sideBridgeInstance.connect(user1).unfreezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should not unfreeze the bridge (by maintianer)", async function () {
                await sideBridgeInstance.connect(maintainer).freezeBridge();
                expect(await sideBridgeInstance.isFrozen()).to.equal(true);
                await expect(sideBridgeInstance.connect(maintainer).unfreezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Assets freezing operations", function () {
            it("Freeze assets by maintainer", async function () {
                await expect(sideBridgeInstance.connect(maintainer).freezeAssetsByMaintainer(tokenAddresses));
                for(let i; i < tokenAddresses.length; i++){
                    expect(await sideBridgeInstance.isAssetFrozen(tokenAddresses[i])).to.be.true;
                }
            });

            it("Should not freeze asset by user", async function () {
                await expect(sideBridgeInstance.connect(user1).freezeAssetsByMaintainer(tokenAddresses))
                    .to.be.reverted;
            });

            it("Should freeze asset by congress", async function () {
                await expect(sideBridgeInstance.connect(chainportCongress).setAssetFreezeState(token.address, true))
                    .to.emit(sideBridgeInstance, 'AssetFrozen')
                    .withArgs(token.address, true);
            });

            it("Should not unfreeze asset by user or maintainer", async function () {
                await sideBridgeInstance.connect(chainportCongress).setAssetFreezeState(token.address, true);
                await expect(sideBridgeInstance.connect(user1).setAssetFreezeState(token.address, false))
                    .to.be.reverted;
            });

            it("Should unfreeze asset by congress", async function () {
                await expect(sideBridgeInstance.connect(chainportCongress).setAssetFreezeState(token.address, false))
                    .to.emit(sideBridgeInstance, 'AssetFrozen')
                    .withArgs(token.address, false);
            });
        });

        describe("Maintainer work in progress", function () {

            it("Should set maintainer workInProgress by maintainer", async function () {
                await sideBridgeInstance.connect(maintainer).setMaintainerWorkInProgress(true);
                expect(await sideBridgeInstance.maintainerWorkInProgress()).to.be.true;
            });

            it("Should not set maintainer workInProgress by user", async function () {
                await expect(sideBridgeInstance.connect(user1).setMaintainerWorkInProgress(true))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });
        });

        describe("Network activation", function () {

            it("Should activate network (as maintainer)", async function () {
                await expect(sideBridgeInstance.connect(maintainer).activateNetwork(1))
                    .to.emit(sideBridgeInstance, 'NetworkActivated')
                    .withArgs(1);
                expect(await sideBridgeInstance.isNetworkActive(1)).to.be.true;
            });

            it("Should not activate network (as user)", async function () {
                await expect(sideBridgeInstance.connect(user1).activateNetwork(1))
                    .to.be.revertedWith('ChainportUpgradables: Restricted only to Maintainer');
            });

            it("Should deactivate network (as congress)", async function () {
                await expect(sideBridgeInstance.connect(maintainer).activateNetwork(1))
                    .to.emit(sideBridgeInstance, 'NetworkActivated')
                    .withArgs(1);
                expect(await sideBridgeInstance.isNetworkActive(1)).to.be.true;
                await expect(sideBridgeInstance.connect(chainportCongress).deactivateNetwork(1))
                    .to.emit(sideBridgeInstance, 'NetworkDeactivated')
                    .withArgs(1);
                expect(await sideBridgeInstance.isNetworkActive(1)).to.be.false;
            });

            it("Should not deactivate network (as user)", async function () {
                await sideBridgeInstance.connect(maintainer).activateNetwork(1);
                expect(await sideBridgeInstance.isNetworkActive(1)).to.be.true;
                await expect(sideBridgeInstance.connect(user1).deactivateNetwork(1))
                    .to.be.revertedWith('ChainportUpgradables: Restricted only to ChainportCongress');
            });
        });

        describe("Token Minting", function () {

            it("Should mint a new token (by maintainer)", async function () {
                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);
            });

            it("Should not mint same token second time", async function () {
                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);
                await expect(sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals))
                    .to.be.revertedWith("Error: Token already exists.");
            });

            it("Should not mint a new token (by user)", async function () {
                await expect(sideBridgeInstance.connect(user1).mintNewToken(token.address, "", "", decimals))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should not mint a new token when bridge is frozen", async function () {
                await sideBridgeInstance.connect(maintainer).freezeBridge();
                expect(await sideBridgeInstance.isFrozen()).to.equal(true);
                await expect(sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals))
                    .to.be.revertedWith("Error: All Bridge actions are currently frozen.");
            });

            it("Should not mint tokens (by non bridge contract)", async function () {
                // current bridge contract address is chainportCongress
                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens");
                await expect(sideBridgeInstance.connect(maintainer).mintTokens(token.address, user1.address, tokenAmount, lastNonce + nonceIncrease))
                    .to.be.revertedWith("Only Bridge contract can mint new tokens.");
            });

            it("Should not change the bridge contract address (by user)", async function() {
                expect(await token.sideBridgeContract()).to.equal(chainportCongress.address);
                await expect(token.connect(user1).setSideBridgeContract(maintainer.address)).to.be.reverted;
            });

            it("Should change the bridge contract address", async function() {
                expect(await token.sideBridgeContract()).to.equal(chainportCongress.address);
                await token.connect(chainportCongress).setSideBridgeContract(sideBridgeInstance.address);
                expect(await token.sideBridgeContract()).to.equal(sideBridgeInstance.address);
            });

            it("Should mint tokens", async function () {
                await token.connect(chainportCongress).setSideBridgeContract(sideBridgeInstance.address);
                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens");
                await sideBridgeInstance.connect(maintainer).mintTokens(token.address, user1.address, tokenAmount, lastNonce + nonceIncrease);
            });

            it("Should not mint tokens (by user)", async function () {
                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens");
                await expect(sideBridgeInstance.connect(user1).mintTokens(token.address, user2.address, tokenAmount, lastNonce + nonceIncrease))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should not mint tokens with already used nonce", async function () {
                await token.connect(chainportCongress).setSideBridgeContract(sideBridgeInstance.address);
                sideBridgeInstance.connect(maintainer).mintTokens(token.address, user1.address, tokenAmount, 435);
                await expect(sideBridgeInstance.connect(maintainer).mintTokens(token.address, user1.address, tokenAmount, 435))
                    .to.be.revertedWith('Error: Nonce already used.');
            });

            it("Should not mint tokens when amount is below or equal to zero", async function () {
                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens");
                await expect(sideBridgeInstance.connect(maintainer).mintTokens(token.address, user2.address, 0, lastNonce + nonceIncrease))
                    .to.be.revertedWith("Amount is not greater than zero.");
            });

            it("Should not mint tokens when bridge is frozen", async function () {
                await sideBridgeInstance.connect(maintainer).freezeBridge();
                expect(await sideBridgeInstance.isFrozen()).to.equal(true);
                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens");
                await expect(sideBridgeInstance.connect(maintainer)
                    .mintTokens(token.address, user1.address, tokenAmount, lastNonce + nonceIncrease))
                    .to.be.revertedWith("Error: All Bridge actions are currently frozen.");
            });
        });

        describe("Token Burning", function () {

            it("Should burn a token made by the bridge (by maintainer)", async function () {

                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);

                let bepTokenAddress = await sideBridgeInstance.originalAssetToBridgeToken(token.address);

                let bepToken = await ethers.getContractAt("BridgeMintableToken", bepTokenAddress);

                await bepToken.connect(maintainer).approve(sideBridgeInstance.address, tokenAmount);

                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens");
                await sideBridgeInstance.connect(maintainer).mintTokens(
                    bepToken.address, maintainer.address, tokenAmount, lastNonce + nonceIncrease);

                await sideBridgeInstance.connect(maintainer).burnTokens(bepToken.address, 1);

                expect(await bepToken.balanceOf(maintainer.address)).to.equal(tokenAmount - 1);
            });

            it("Should not burn a token if amount exceeds allowance", async function () {

                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);

                let bepToken = await sideBridgeInstance.originalAssetToBridgeToken(token.address);

                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens");
                await sideBridgeInstance.connect(maintainer).mintTokens(
                    bepToken, maintainer.address, tokenAmount, lastNonce + nonceIncrease);

                await expect(sideBridgeInstance.connect(maintainer).burnTokens(bepToken, 1))
                    .to.be.revertedWith("ERC20: burn amount exceeds allowance");
            });

            it("Should not burn a token if amount is below or equal to zero", async function () {

                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);

                let bepToken = await sideBridgeInstance.originalAssetToBridgeToken(token.address);

                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens");
                await sideBridgeInstance.connect(maintainer).mintTokens(
                    bepToken, maintainer.address, tokenAmount, lastNonce + nonceIncrease);

                await expect(sideBridgeInstance.connect(maintainer).burnTokens(bepToken, 0))
                    .to.be.revertedWith("Amount is not greater than zero.");
            });

            it("Should not burn a token which was not created by the bridge", async function () {
                await expect(sideBridgeInstance.connect(maintainer).burnTokens(
                    await sideBridgeInstance.originalAssetToBridgeToken(token.address), 1))
                    .to.be.revertedWith("Error: Token is not created by the bridge.");
            });
        });

        // Function removed
        xdescribe("Delete Minted Tokens", function () {

            it("Should not delete minted tokens (by user))", async function () {
                bscTokenAddr = await sideBridgeInstance.originalAssetToBridgeToken(token.address);
                expect(bscTokenAddr.toString()).to.be.equal(zeroAddress);
                expect(await sideBridgeInstance.isCreatedByTheBridge(bscTokenAddr)).to.be.false;
                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);
                bscTokenAddr = await sideBridgeInstance.originalAssetToBridgeToken(token.address);
                expect(bscTokenAddr.toString()).to.not.equal(zeroAddress);
                expect(await sideBridgeInstance.isCreatedByTheBridge(bscTokenAddr)).to.be.true;

                await expect(sideBridgeInstance.connect(user1).deleteMintedTokens([token.address]))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should delete minted tokens (by maintainer))", async function () {
                bscTokenAddr = await sideBridgeInstance.originalAssetToBridgeToken(token.address);
                expect(bscTokenAddr.toString()).to.be.equal(zeroAddress);
                expect(await sideBridgeInstance.isCreatedByTheBridge(bscTokenAddr)).to.be.false;
                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);
                bscTokenAddr = await sideBridgeInstance.originalAssetToBridgeToken(token.address);
                expect(bscTokenAddr.toString()).to.not.equal(zeroAddress);
                expect(await sideBridgeInstance.isCreatedByTheBridge(bscTokenAddr)).to.be.true;

                newToken = await ethers.getContractFactory("BridgeMintableToken");
                newToken = await newToken.deploy("Fake Token", "FKT", decimals);

                bscNewTokenAddr = await sideBridgeInstance.originalAssetToBridgeToken(newToken.address);
                expect(bscNewTokenAddr.toString()).to.be.equal(zeroAddress);
                expect(await sideBridgeInstance.isCreatedByTheBridge(bscNewTokenAddr)).to.be.false;
                await sideBridgeInstance.connect(maintainer).mintNewToken(newToken.address, "", "", decimals);
                bscNewTokenAddr = await sideBridgeInstance.originalAssetToBridgeToken(newToken.address);
                expect(bscNewTokenAddr.toString()).to.not.equal(zeroAddress);
                expect(await sideBridgeInstance.isCreatedByTheBridge(bscNewTokenAddr)).to.be.true;

                await sideBridgeInstance.connect(maintainer).deleteMintedTokens([token.address, newToken.address]);
                bscTokenAddr = await sideBridgeInstance.originalAssetToBridgeToken(token.address);
                expect(bscTokenAddr.toString()).to.be.equal(zeroAddress);
                expect(await sideBridgeInstance.isCreatedByTheBridge(bscTokenAddr)).to.be.false;
                bscNewTokenAddr = await sideBridgeInstance.originalAssetToBridgeToken(newToken.address);
                expect(bscNewTokenAddr.toString()).to.be.equal(zeroAddress);
                expect(await sideBridgeInstance.isCreatedByTheBridge(bscNewTokenAddr)).to.be.false;
            });
        });

        describe("Cross chain transfer", function () {
            it("Should perform cross chain transfer", async function () {

                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);

                let bepTokenAddress = await sideBridgeInstance.originalAssetToBridgeToken(token.address);

                let bepToken = await ethers.getContractAt("BridgeMintableToken", bepTokenAddress);

                await bepToken.connect(maintainer).approve(sideBridgeInstance.address, tokenAmount);

                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens");
                await sideBridgeInstance.connect(maintainer).mintTokens(
                    bepToken.address, maintainer.address, tokenAmount, lastNonce + nonceIncrease);

                await sideBridgeInstance.connect(maintainer).activateNetwork(1);

                await expect(sideBridgeInstance.connect(maintainer).crossChainTransfer(bepToken.address, tokenAmount-1, 1))
                    .to.emit(sideBridgeInstance, 'TokensTransferred')
                    .withArgs(bepToken.address, maintainer.address, tokenAmount-1, 1);
            });

            it("Should not perform cross chain transfer (network not activated)", async function () {
                await expect(sideBridgeInstance.connect(user1).crossChainTransfer(token.address, tokenAmount-1, 1))
                    .to.be.revertedWith("Error: Network with this id is not supported.");
            });

            it("Should not perform cross chain transfer (Token not created by the bridge)", async function () {
                await sideBridgeInstance.connect(maintainer).activateNetwork(1);
                await expect(sideBridgeInstance.connect(user1).crossChainTransfer(token.address, tokenAmount-1, 1))
                    .to.be.revertedWith("Error: Token is not created by the bridge.");

            });

            it("Should not perform cross chain transfer (Token amount 0)", async function () {
                await sideBridgeInstance.connect(maintainer).activateNetwork(1);
                await expect(sideBridgeInstance.connect(user1).crossChainTransfer(token.address, 0, 1))
                    .to.be.revertedWith('Error: Amount is not greater than zero.');
            });

            it("Should not perform cross chain transfer (Token amount exceeds allowance)", async function () {
                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);

                let bepTokenAddress = await sideBridgeInstance.originalAssetToBridgeToken(token.address);

                let bepToken = await ethers.getContractAt("BridgeMintableToken", bepTokenAddress);

                await bepToken.connect(maintainer).approve(sideBridgeInstance.address, tokenAmount);

                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens");
                await sideBridgeInstance.connect(maintainer).mintTokens(
                    bepToken.address, maintainer.address, tokenAmount, lastNonce + nonceIncrease);

                await sideBridgeInstance.connect(maintainer).activateNetwork(1);
                await expect(sideBridgeInstance.connect(maintainer).crossChainTransfer(bepToken.address, tokenAmount+1, 1))
                    .to.be.revertedWith('ERC20: burn amount exceeds allowance');
            });
        });

        describe("Path Pause Flow", function(){
            it("Should pause path by maintainer", async function () {
                await sideBridgeInstance.connect(maintainer).setPathPauseState(token.address, "crossChainTransfer", true);
                expect(await sideBridgeInstance.isPathPaused(token.address, "crossChainTransfer")).to.be.true;
            });

            it("Should not perform function when funnel is paused", async function () {

                // crossChainTransfer function setup preparation
                await sideBridgeInstance.connect(maintainer).mintNewToken(token.address, "", "", decimals);

                let bepTokenAddress = await sideBridgeInstance.originalAssetToBridgeToken(token.address);

                let bepToken = await ethers.getContractAt("BridgeMintableToken", bepTokenAddress);

                await bepToken.connect(maintainer).approve(sideBridgeInstance.address, tokenAmount);

                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens");
                await sideBridgeInstance.connect(maintainer).mintTokens(
                    bepToken.address, maintainer.address, tokenAmount, lastNonce + nonceIncrease);

                await sideBridgeInstance.connect(maintainer).activateNetwork(1);

                // The test
                await sideBridgeInstance.connect(maintainer).setPathPauseState(bepToken.address, "crossChainTransfer", true);
                expect(await sideBridgeInstance.isPathPaused(bepToken.address, "crossChainTransfer")).to.be.true;

                await expect(sideBridgeInstance.connect(maintainer).crossChainTransfer(bepToken.address, tokenAmount-1, 1))
                    .to.be.revertedWith("Error: Path is paused.");
            });

            it("Should not pause path by user", async function () {
                await expect(sideBridgeInstance.connect(user1).setPathPauseState(token.address, "crossChainTransfer", true))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
                expect(await sideBridgeInstance.isPathPaused(token.address, "crossChainTransfer")).to.be.false;
            });

            it("Should unpause funnel by maintainer", async function () {
                await sideBridgeInstance.connect(maintainer).setPathPauseState(token.address, "crossChainTransfer", true);
                expect(await sideBridgeInstance.isPathPaused(token.address, "crossChainTransfer")).to.be.true;
                await sideBridgeInstance.connect(maintainer).setPathPauseState(token.address, "crossChainTransfer", false);
                expect(await sideBridgeInstance.isPathPaused(token.address, "crossChainTransfer")).to.be.false;
            });

            it("Should not unpause path by user", async function () {
                await sideBridgeInstance.connect(maintainer).setPathPauseState(token.address, "crossChainTransfer", true);
                expect(await sideBridgeInstance.isPathPaused(token.address, "crossChainTransfer")).to.be.true;
                await expect(sideBridgeInstance.connect(user1).setPathPauseState(token.address, "crossChainTransfer", false))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
                expect(await sideBridgeInstance.isPathPaused(token.address, "crossChainTransfer")).to.be.true;
            });
        });
    });
});
