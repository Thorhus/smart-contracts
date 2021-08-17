const { expect } = require("chai");
const { signatoryAddress, createHash, generateSignature } = require('./testHelpers')

describe("Main Bridge Test", function () {

    let maintainersRegistry, maintainersRegistryInstance, mainBridge, mainBridgeInstance, fundManager,
        validator, validatorInstance, chainportCongress, maintainer, maintainers, user1, user2, token,
        tokenAmount = 50, nonceIncrease = 1, decimals = 18;

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    beforeEach(async function() {

        [chainportCongress, user1, user2, maintainer, fundManager, ...maintainers] = await ethers.getSigners();
        maintainersRegistry = await ethers.getContractFactory("MaintainersRegistry");

        fundManager = fundManager.address;

        maintainersRegistryInstance = await maintainersRegistry.deploy();
        for(let i = 0; i < maintainers.length; i++) {
            maintainers[i] = maintainers[i].address;
        }

        maintainers[maintainers.length] = maintainer.address;

        await maintainersRegistryInstance.initialize(maintainers, chainportCongress.address);

        token = await ethers.getContractFactory("BridgeMintableToken");
        token = await token.deploy("", "", decimals);

        validator = await ethers.getContractFactory("Validator");
        validatorInstance = await validator.deploy();
        await validatorInstance.initialize(signatoryAddress, user1.address, user2.address)

        mainBridge = await ethers.getContractFactory("ChainportMainBridge");
        mainBridgeInstance = await mainBridge.deploy();
    });

    it("Should initialize", async function () {
        await mainBridgeInstance.initialize(
            maintainersRegistryInstance.address,
            chainportCongress.address,
            validatorInstance.address
        )
    });

    describe("Functions", function () {

        beforeEach(async function () {
            await mainBridgeInstance.initialize(
                maintainersRegistryInstance.address,
                chainportCongress.address,
                validatorInstance.address
            );
        });

        describe("Check if values are set properly", function () {

            it("Maintainers registry is set properly", async function () {
                expect(await mainBridgeInstance.maintainersRegistry()).to.equal(maintainersRegistryInstance.address);
            });

            it("Chainport congress address is set properly", async function () {
                expect(await mainBridgeInstance.chainportCongress()).to.equal(chainportCongress.address);
            });

            it("Validator address is set properly", async function () {
                expect(await mainBridgeInstance.signatureValidator()).to.equal(validatorInstance.address);
            });

        });

        describe("Asset protection", function () {

            it("Should protect the asset (by congress)", async function () {
                await mainBridgeInstance.connect(chainportCongress).setAssetProtection(token.address, true);
                expect(await mainBridgeInstance.isAssetProtected(token.address)).to.equal(true);
            });

            it("Should remove protection on the asset (by congress)", async function () {
                await mainBridgeInstance.connect(chainportCongress).setAssetProtection(token.address, true);
                expect(await mainBridgeInstance.isAssetProtected(token.address)).to.equal(true);
                await mainBridgeInstance.connect(chainportCongress).setAssetProtection(token.address, false);
                expect(await mainBridgeInstance.isAssetProtected(token.address)).to.equal(false);
            });

            it("Should not protect the asset (by user)", async function () {
                await expect(mainBridgeInstance.connect(user1).setAssetProtection(token.address, true))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should not remove protection on the asset (by user)", async function () {
                await mainBridgeInstance.connect(chainportCongress).setAssetProtection(token.address, true);
                expect(await mainBridgeInstance.isAssetProtected(token.address)).to.equal(true);
                await expect(mainBridgeInstance.connect(user1).setAssetProtection(token.address, false))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should protect asset by maintainer", async function () {
                await mainBridgeInstance.connect(maintainer).protectAssetByMaintainer(token.address);
            });

            it("Should not protect asset by maintainer (by user)", async function () {
                await expect(mainBridgeInstance.connect(user1).protectAssetByMaintainer(token.address))
                    .to.be.reverted;
            });
        });

        describe("Bridge Freezing Operations", function () {

            it("Should freeze the bridge (by maintainer)", async function () {
                await mainBridgeInstance.connect(maintainer).freezeBridge();
                expect(await mainBridgeInstance.isFrozen()).to.equal(true);
            });

            it("Should unfreeze the bridge (by congress)", async function () {
                await mainBridgeInstance.connect(maintainer).freezeBridge();
                expect(await mainBridgeInstance.isFrozen()).to.equal(true);
                await mainBridgeInstance.connect(chainportCongress).unfreezeBridge();
                expect(await mainBridgeInstance.isFrozen()).to.equal(false);
            });

            it("Should not let freeze the bridge (by user)", async function () {
                await expect(mainBridgeInstance.connect(user1).freezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should not let unfreeze the bridge (by user)", async function () {
                await mainBridgeInstance.connect(maintainer).freezeBridge();
                expect(await mainBridgeInstance.isFrozen()).to.equal(true);
                await expect(mainBridgeInstance.connect(user1).unfreezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Assete freezing operations", function () {
            it("Freeze asset by maintainer", async function () {
                await expect(mainBridgeInstance.connect(maintainer).freezeAssetByMaintainer(token.address))
                    .to.emit(mainBridgeInstance, 'AssetFrozen')
                    .withArgs(token.address,true);
            });

            it("Should not freeze asset by user", async function () {
                await expect(mainBridgeInstance.connect(user1).freezeAssetByMaintainer(token.address))
                    .to.be.reverted;
            });

            it("Should freeze asset by congress", async function () {
                 await expect(mainBridgeInstance.connect(chainportCongress).setAssetFreezeState(token.address, true))
                     .to.emit(mainBridgeInstance, 'AssetFrozen')
                     .withArgs(token.address, true);
            });

            it("Should not unfreeze asset by user or maintainer", async function () {
                await mainBridgeInstance.connect(chainportCongress).setAssetFreezeState(token.address, true);
                await expect(mainBridgeInstance.connect(user1).setAssetFreezeState(token.address, false))
                    .to.be.reverted;
            });

            it("Should unfreeze asset by congress", async function () {
                await expect(mainBridgeInstance.connect(chainportCongress).setAssetFreezeState(token.address, false))
                    .to.emit(mainBridgeInstance, 'AssetFrozen')
                    .withArgs(token.address, false);
            });
        });

        describe("Network activation", function () {

            it("Should activate network (as maintainer)", async function () {
                await expect(mainBridgeInstance.connect(maintainer).activateNetwork(1))
                    .to.emit(mainBridgeInstance, 'NetworkActivated')
                    .withArgs(1);
                expect(await mainBridgeInstance.isNetworkActive(1)).to.be.true;
            });

            it("Should not activate network (as user)", async function () {
                await expect(mainBridgeInstance.connect(user1).activateNetwork(1))
                    .to.be.revertedWith('ChainportUpgradables: Restricted only to Maintainer');
            });

            it("Should deactivate network (as congress)", async function () {
                await expect(mainBridgeInstance.connect(maintainer).activateNetwork(1))
                    .to.emit(mainBridgeInstance, 'NetworkActivated')
                    .withArgs(1);
                expect(await mainBridgeInstance.isNetworkActive(1)).to.be.true;
                await expect(mainBridgeInstance.connect(chainportCongress).deactivateNetwork(1))
                    .to.emit(mainBridgeInstance, 'NetworkDeactivated')
                    .withArgs(1);
                expect(await mainBridgeInstance.isNetworkActive(1)).to.be.false;
            });

            it("Should not deactivate network (as user)", async function () {
                await mainBridgeInstance.connect(maintainer).activateNetwork(1);
                expect(await mainBridgeInstance.isNetworkActive(1)).to.be.true;
                await expect(mainBridgeInstance.connect(user1).deactivateNetwork(1))
                    .to.be.revertedWith('ChainportUpgradables: Restricted only to ChainportCongress');
            });
        });

        describe("Token Depositing", function () {

            beforeEach(async function () {
                let sideBridgeInstance = await ethers.getContractFactory("ChainportSideBridge");
                sideBridgeInstance = await sideBridgeInstance.deploy();

                await sideBridgeInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);

                await token.connect(chainportCongress).setSideBridgeContract(sideBridgeInstance.address);
                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens");
                await sideBridgeInstance.connect(maintainer)
                    .mintTokens(token.address, user1.address, tokenAmount, lastNonce + nonceIncrease);

                await token.connect(user1).approve(mainBridgeInstance.address, tokenAmount);

            });

            it("Should deposit the token to specified bridge", async function () {
                await mainBridgeInstance.connect(maintainer).activateNetwork(1);
                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, tokenAmount - 1, 1))
                    .to.emit(mainBridgeInstance, 'TokensDeposited')
                    .withArgs(token.address, user1.address , tokenAmount - 1, 1);
            });

            it("Should not deposit the token to specified bridge (network not active)", async function () {
                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, tokenAmount - 1, 1))
                    .to.be.revertedWith("Error: Network with this id is not supported.");
            });

            it("Should not deposit the token if the amount to freeze is more than the account balance", async function () {
                await mainBridgeInstance.connect(maintainer).activateNetwork(1);
                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, tokenAmount + 1, 1))
                    .to.be.revertedWith("ERC20: transfer amount exceeds balance");
            });

            it("Should not deposit if amount is below or equal to zero", async function () {
                await mainBridgeInstance.connect(maintainer).activateNetwork(1);
                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, 0, 1))
                    .to.be.revertedWith("Amount is not greater than zero.");
            });

            it("Should not deposit the token if exceeds balance", async function () {
                await mainBridgeInstance.connect(maintainer).activateNetwork(1);
                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, tokenAmount + 1, 1))
                    .to.be.revertedWith("ERC20: transfer amount exceeds balance");
            });

            it("Should not deposit the token if exceeds allowance", async function () {
                await mainBridgeInstance.connect(maintainer).activateNetwork(1);
                await token.connect(user1).approve(mainBridgeInstance.address, 0);

                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, tokenAmount - 1, 1))
                    .to.be.revertedWith("ERC20: transfer amount exceeds allowance");
            });

            it("Should not deposit the token if bridge is frozen", async function () {
                await mainBridgeInstance.connect(maintainer).activateNetwork(1);
                await mainBridgeInstance.connect(maintainer).freezeBridge();
                expect(await mainBridgeInstance.isFrozen()).to.equal(true);

                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, 10, 1))
                    .to.be.revertedWith("Error: All Bridge actions are currently frozen.");
            });
        });

        describe("Token Releasing (Withdrawal)", function () {

            let releaseAmount = 20;

            beforeEach(async function () {
                let sideBridgeInstance = await ethers.getContractFactory("ChainportSideBridge");
                sideBridgeInstance = await sideBridgeInstance.deploy();

                await sideBridgeInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);

                await token.connect(chainportCongress).setSideBridgeContract(sideBridgeInstance.address);
                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens");
                await sideBridgeInstance.connect(maintainer)
                    .mintTokens(token.address, user1.address, tokenAmount, lastNonce + nonceIncrease);

                await token.connect(user1).approve(mainBridgeInstance.address, tokenAmount);

                await mainBridgeInstance.connect(maintainer).activateNetwork(1);

                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, tokenAmount, 1))
                    .to.emit(mainBridgeInstance, 'TokensDeposited')
                    .withArgs(token.address, user1.address , tokenAmount, 1);
            });

            describe("Release Tokens By Maintainer", function (){

                beforeEach(async () => {
                    await mainBridgeInstance.connect(chainportCongress).setFundManager(fundManager);
                });

                it("Should not withdraw when amount is less or equal to zero (by maintainer)", async function () {
                    await expect(mainBridgeInstance.connect(maintainer).releaseTokensByMaintainer(
                        token.address,
                        0,
                        0
                    )).to.be.revertedWith("Amount is not greater than zero.");
                });

                it("Should withdraw tokens (by maintainer)", async function () {
                    await mainBridgeInstance.connect(maintainer).releaseTokensByMaintainer(
                        token.address,
                        releaseAmount,
                        1
                    );
                });
            });

            describe("Release Tokens", function () {

                it("Should release tokens", async function () {
                    await mainBridgeInstance.connect(user1).releaseTokens(
                        generateSignature(createHash(1, user1.address, releaseAmount, token.address)),
                        token.address,
                        releaseAmount,
                        1
                    );
                });

                it("Should not withdraw when singature length is not right", async function () {
                    await expect(mainBridgeInstance.connect(maintainer).releaseTokens(
                        "0x00",
                        token.address,
                        releaseAmount,
                        await mainBridgeInstance.functionNameToNonce("releaseTokens") + 1
                    )).to.be.revertedWith("bad signature length");
                });

                it("Should not withdraw when bridge is frozen (by maintainer)", async function () {
                    await mainBridgeInstance.connect(maintainer).freezeBridge();
                    expect(await mainBridgeInstance.isFrozen()).to.equal(true);

                    await expect(mainBridgeInstance.connect(maintainer).releaseTokens(
                        "0x00",
                        token.address,
                        releaseAmount,
                        await mainBridgeInstance.functionNameToNonce("releaseTokens") + 1
                    )).to.be.revertedWith("Error: All Bridge actions are currently frozen.");
                });

                it("Should not withdraw when amount is less or equal to zero", async function () {
                    await expect(mainBridgeInstance.connect(maintainer).releaseTokens(
                        "0x00",
                        token.address,
                        0,
                        await mainBridgeInstance.functionNameToNonce("releaseTokens") + 1
                    )).to.be.revertedWith("Amount is not greater than zero.");
                });
            });
        });

        describe("Path Pause Flow", function(){

            it("Should pause path by maintainer", async function () {
                await mainBridgeInstance.connect(maintainer).setPathPauseState(token.address, "depositTokens", true);
                expect(await mainBridgeInstance.isPathPaused(token.address, "depositTokens")).to.be.true;
            });

            it("Should not perform function when funnel is paused", async function () {

                await mainBridgeInstance.connect(maintainer).activateNetwork(1);

                await mainBridgeInstance.connect(maintainer).setPathPauseState(token.address, "depositTokens", true);
                expect(await mainBridgeInstance.isPathPaused(token.address, "depositTokens")).to.be.true;

                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, tokenAmount - 1, 1))
                    .to.be.revertedWith("Error: Path is paused.");
            });

            it("Should not pause path by user", async function () {
                await expect(mainBridgeInstance.connect(user1).setPathPauseState(token.address, "depositTokens", true))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
                expect(await mainBridgeInstance.isPathPaused(token.address, "depositTokens")).to.be.false;
            });

            it("Should unpause funnel by maintainer", async function () {
                await mainBridgeInstance.connect(maintainer).setPathPauseState(token.address, "depositTokens", true);
                expect(await mainBridgeInstance.isPathPaused(token.address, "depositTokens")).to.be.true;
                await mainBridgeInstance.connect(maintainer).setPathPauseState(token.address, "depositTokens", false);
                expect(await mainBridgeInstance.isPathPaused(token.address, "depositTokens")).to.be.false;
            });

            it("Should not unpause path by user", async function () {
                await mainBridgeInstance.connect(maintainer).setPathPauseState(token.address, "depositTokens", true);
                expect(await mainBridgeInstance.isPathPaused(token.address, "depositTokens")).to.be.true;
                await expect(mainBridgeInstance.connect(user1).setPathPauseState(token.address, "depositTokens", false))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
                expect(await mainBridgeInstance.isPathPaused(token.address, "depositTokens")).to.be.true;
            });
        });

        describe("Set fundManager contract test", () => {

            it("Should set new fundManager address by congress", async () => {
                expect(await mainBridgeInstance.fundManager()).to.equal(ZERO_ADDRESS);
                await mainBridgeInstance.connect(chainportCongress).setFundManager(fundManager);
                expect(await mainBridgeInstance.fundManager()).to.equal(fundManager);
            });

            it("Should not set new fundManager address by non congress wallet", async () => {
                expect(await mainBridgeInstance.fundManager()).to.equal(ZERO_ADDRESS);
                await expect(mainBridgeInstance.connect(user1).setFundManager(fundManager))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });
    });
});
